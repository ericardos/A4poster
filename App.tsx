
import React, { useState, useRef, useMemo } from 'react';
import { Upload, Download, Maximize, Trash2, Scissors, Heart, Copy, Check, Sparkles, Star, Image as ImageIcon } from 'lucide-react';
import { TileSettings, ImageMetadata } from './types';
import { DEFAULT_SETTINGS, PAPER_SIZES } from './constants';

const App: React.FC = () => {
  const [image, setImage] = useState<ImageMetadata | null>(null);
  const [settings, setSettings] = useState<TileSettings>(DEFAULT_SETTINGS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPix, setShowPix] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const PIX_KEY = "fdf03993-fbdd-4b89-be41-6e63d2352729";

  const copyPix = () => {
    navigator.clipboard.writeText(PIX_KEY);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const drawMetrics = useMemo(() => {
    if (!image) return null;
    
    const paper = PAPER_SIZES[settings.paperSize];
    const pWidth = settings.orientation === 'portrait' ? paper.width : paper.height;
    const pHeight = settings.orientation === 'portrait' ? paper.height : paper.width;

    const totalPosterWidth = pWidth * settings.cols;
    const totalPosterHeight = pHeight * settings.rows;
    
    const posterAspect = totalPosterWidth / totalPosterHeight;
    const imageAspect = image.width / image.height;

    let finalDrawW, finalDrawH;
    
    if (imageAspect > posterAspect) {
      finalDrawW = totalPosterWidth;
      finalDrawH = totalPosterWidth / imageAspect;
    } else {
      finalDrawH = totalPosterHeight;
      finalDrawW = totalPosterHeight * imageAspect;
    }

    return { 
      finalDrawW, finalDrawH, 
      pWidth, pHeight,
      totalPosterWidth, totalPosterHeight,
      posterAspect
    };
  }, [image, settings]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const aspectRatio = img.width / img.height;
        setImage({
          src: event.target?.result as string,
          width: img.width,
          height: img.height,
          aspectRatio
        });
        
        const bestOrientation = aspectRatio > 1 ? 'landscape' : 'portrait';
        setSettings(prev => ({ 
          ...prev, 
          cols: aspectRatio > 1 ? 3 : 2, 
          rows: aspectRatio > 1 ? 2 : 3, 
          orientation: bestOrientation 
        }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const generatePDF = async () => {
    if (!image || !drawMetrics) return;
    setIsGenerating(true);

    try {
      const { jsPDF } = (window as any).jspdf;
      const { pWidth, pHeight, finalDrawW, finalDrawH } = drawMetrics;

      const pdf = new jsPDF({
        orientation: settings.orientation,
        unit: 'mm',
        format: settings.paperSize
      });

      const img = new Image();
      img.src = image.src;
      await new Promise((resolve) => { img.onload = resolve; });

      for (let r = 0; r < settings.rows; r++) {
        for (let c = 0; c < settings.cols; c++) {
          if (r > 0 || c > 0) pdf.addPage(settings.paperSize, settings.orientation);

          const canvas = document.createElement('canvas');
          const imgChunkW = image.width / settings.cols;
          const imgChunkH = image.height / settings.rows;

          canvas.width = imgChunkW;
          canvas.height = imgChunkH;
          const ctx = canvas.getContext('2d');
          
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(
              img,
              c * imgChunkW, r * imgChunkH, imgChunkW, imgChunkH,
              0, 0, imgChunkW, imgChunkH
            );

            const imgData = canvas.toDataURL('image/png', 1.0);
            const drawW = finalDrawW / settings.cols;
            const drawH = finalDrawH / settings.rows;
            const localOffsetX = (pWidth - drawW) / 2;
            const localOffsetY = (pHeight - drawH) / 2;

            pdf.addImage(imgData, 'PNG', localOffsetX, localOffsetY, drawW, drawH);
            pdf.setDrawColor(220, 220, 220);
            pdf.setLineWidth(0.1);
            pdf.rect(localOffsetX, localOffsetY, drawW, drawH);
            
            pdf.setFontSize(6);
            pdf.setTextColor(150);
            pdf.text(`Página ${r * settings.cols + c + 1} | Linha ${r+1}, Col ${c+1}`, pWidth/2, pHeight - 5, { align: 'center' });
          }
        }
      }

      pdf.save(`A4poster-projeto.pdf`);
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar PDF.");
    } finally {
      setIsGenerating(false);
    }
  };

  const updateSetting = <K extends keyof TileSettings>(key: K, value: TileSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between z-30 shadow-sm shrink-0">
        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => window.location.reload()}>
          <div className="bg-rose-600 p-2 rounded-xl shadow-lg group-hover:rotate-12 transition-transform">
            <Scissors className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-black tracking-tighter text-slate-800 uppercase italic">A4<span className="text-rose-600">poster</span></h1>
        </div>
        
        {image && (
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowPix(true)}
              className="flex items-center gap-2 bg-[#0F172A] text-white px-5 py-2.5 rounded-full font-black transition-all text-[11px] shadow-lg hover:scale-105 active:scale-95 uppercase tracking-wider"
            >
              <Heart className="w-4 h-4 fill-white animate-pulse" />
              Apoiar
            </button>
            <button 
              onClick={generatePDF}
              disabled={isGenerating}
              className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-full font-bold text-sm transition-all disabled:opacity-50 active:scale-95 shadow-xl"
            >
              {isGenerating ? <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div> : <Download className="w-4 h-4" />}
              GERAR PDF
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {image && (
          <aside className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-slate-200 p-6 overflow-y-auto shrink-0 z-20">
            <div className="space-y-6 animate-in slide-in-from-left">
              <section className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex justify-between mb-2"><label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Colunas</label><span className="text-rose-600 font-black">{settings.cols}</span></div>
                  <input type="range" min="1" max="15" value={settings.cols} onChange={(e) => updateSetting('cols', parseInt(e.target.value))} className="w-full accent-rose-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                </div>
                
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex justify-between mb-2"><label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Linhas</label><span className="text-rose-600 font-black">{settings.rows}</span></div>
                  <input type="range" min="1" max="15" value={settings.rows} onChange={(e) => updateSetting('rows', parseInt(e.target.value))} className="w-full accent-rose-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Orientação</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => updateSetting('orientation', 'portrait')} className={`py-3 text-[10px] font-black uppercase rounded-xl border-2 transition-all ${settings.orientation === 'portrait' ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-400 border-slate-100'}`}>Vertical</button>
                  <button onClick={() => updateSetting('orientation', 'landscape')} className={`py-3 text-[10px] font-black uppercase rounded-xl border-2 transition-all ${settings.orientation === 'landscape' ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-400 border-slate-100'}`}>Horizontal</button>
                </div>
              </section>

              <button onClick={() => setImage(null)} className="w-full py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors flex items-center justify-center gap-2">
                <Trash2 className="w-3 h-3" /> Limpar Imagem
              </button>
            </div>
          </aside>
        )}

        <div className="flex-1 bg-slate-100 p-4 md:p-8 flex items-center justify-center relative dashed-grid overflow-hidden">
          {!image ? (
            <div className="flex flex-col items-center justify-center gap-4 w-full max-w-lg px-4 animate-in fade-in duration-700 h-full">
              {/* Quadro de Upload Único */}
              <div 
                onClick={() => fileInputRef.current?.click()} 
                className="w-full aspect-video bg-white rounded-[2rem] border-4 border-dashed border-rose-400/30 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-rose-500 hover:bg-white/80 transition-all shadow-xl group relative active:scale-95"
              >
                <div className="w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6 text-rose-600" />
                </div>
                <div className="text-center">
                  <p className="text-slate-800 font-black text-lg uppercase italic tracking-tighter leading-none">Arraste ou clique aqui</p>
                  <p className="text-slate-400 font-bold text-[10px] mt-1">Pôster gigante pronto para imprimir em A4</p>
                </div>
              </div>

              {/* Card de Doação - Tamanho Reduzido */}
              <div className="w-full max-w-sm bg-[#F8F9F5] rounded-[2rem] p-5 border border-[#E2E8F0] shadow-sm relative group">
                <div className="absolute top-2 right-4 opacity-5 rotate-12">
                   <Star className="w-12 h-12 text-slate-800" />
                </div>
                
                <div className="flex flex-col items-center text-center space-y-3">
                  <div className="flex items-center gap-4 w-full justify-center">
                    <div className="bg-[#FEF3C7] p-3 rounded-[1rem] shadow-sm">
                      <Heart className="w-6 h-6 text-[#D97706] fill-[#D97706]" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-[#1E293B] font-black uppercase italic text-sm tracking-tight leading-tight">APOIE ESTE PROJETO</h4>
                      <p className="text-[#64748B] text-xs font-medium">Este site é gratuito. Considere apoiar!</p>
                    </div>
                  </div>

                  <button 
                    onClick={() => setShowPix(true)}
                    className="w-full bg-[#0F172A] hover:bg-black text-white px-4 py-3 rounded-[1.2rem] font-black text-xs uppercase tracking-widest shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    VER CHAVE PIX <Sparkles className="w-4 h-4 text-[#FBBF24]" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative animate-in zoom-in duration-500 max-h-full">
              <div 
                className="relative bg-white p-2 shadow-2xl rounded-sm transition-all duration-500 mx-auto"
                style={{
                  aspectRatio: `${drawMetrics.totalPosterWidth} / ${drawMetrics.totalPosterHeight}`,
                  width: drawMetrics.posterAspect > 1 ? 'min(80vw, 700px)' : 'auto',
                  height: drawMetrics.posterAspect > 1 ? 'auto' : 'min(70vh, 600px)',
                }}
              >
                <div 
                  className="absolute inset-0 z-20 grid pointer-events-none"
                  style={{
                    gridTemplateColumns: `repeat(${settings.cols}, 1fr)`,
                    gridTemplateRows: `repeat(${settings.rows}, 1fr)`
                  }}
                >
                  {Array.from({ length: settings.rows * settings.cols }).map((_, i) => (
                    <div key={i} className="border border-white/40 flex items-center justify-center">
                       <div className="bg-black/30 backdrop-blur-md text-white text-[9px] font-black w-6 h-6 flex items-center justify-center rounded-full border border-white/20">
                        {i + 1}
                       </div>
                    </div>
                  ))}
                </div>
                <img src={image.src} className="w-full h-full block object-contain p-1" alt="Preview" />
              </div>

              <div className="mt-6 flex justify-center">
                <div className="bg-slate-900/90 backdrop-blur-md px-6 py-2 rounded-full text-white text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2">
                  <Maximize className="w-3 h-3 text-rose-500" />
                  {(drawMetrics.totalPosterWidth / 10).toFixed(1)} x {(drawMetrics.totalPosterHeight / 10).toFixed(1)} cm
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal do Pix */}
      {showPix && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in zoom-in duration-300">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-2">
                <Heart className="w-6 h-6 text-amber-500 fill-amber-500 animate-pulse" />
              </div>
              <h3 className="text-lg font-black text-slate-800 uppercase italic">Apoio Voluntário</h3>
              <p className="text-slate-500 text-[10px] font-medium leading-relaxed">Sua contribuição ajuda a manter o site no ar e gratuito!</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl flex flex-col items-center space-y-4 border border-slate-100">
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(PIX_KEY)}`} 
                alt="QR Code"
                className="w-32 h-32 rounded-xl shadow-md bg-white p-2"
              />
              <div className="w-full space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-3 text-[9px] font-mono text-slate-600 overflow-hidden truncate">
                    {PIX_KEY}
                  </div>
                  <button 
                    onClick={copyPix}
                    className={`px-4 rounded-xl transition-all shadow-md ${copied ? 'bg-green-500 text-white' : 'bg-slate-900 text-white'}`}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setShowPix(false)}
              className="w-full py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
      
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />

      <footer className="bg-white border-t border-slate-200 px-6 py-3 flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
          <span>A4poster v2.9</span>
        </div>
        <div className="flex gap-4 items-center">
           <button onClick={() => setShowPix(true)} className="text-[#D97706] flex items-center gap-1 font-black">
             <Heart className="w-3 h-3 fill-[#D97706]" /> APOIAR PROJETO
           </button>
        </div>
      </footer>
    </div>
  );
};

export default App;
