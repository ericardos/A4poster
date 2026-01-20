
import React, { useState, useRef, useMemo } from 'react';
import { Upload, Settings, Download, Layers, Maximize, Trash2, Scissors, Info, MousePointer2, CheckCircle2, Heart, Copy, Check, Sparkles, Star, Image as ImageIcon } from 'lucide-react';
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

    let finalDrawW, finalDrawH, offsetX, offsetY;
    
    if (imageAspect > posterAspect) {
      finalDrawW = totalPosterWidth;
      finalDrawH = totalPosterWidth / imageAspect;
      offsetX = 0;
      offsetY = (totalPosterHeight - finalDrawH) / 2;
    } else {
      finalDrawH = totalPosterHeight;
      finalDrawW = totalPosterHeight * imageAspect;
      offsetY = 0;
      offsetX = (totalPosterWidth - finalDrawW) / 2;
    }

    return { 
      finalDrawW, finalDrawH, 
      offsetX, offsetY, 
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
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
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
              className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white px-5 py-2.5 rounded-full font-black transition-all text-[11px] shadow-[0_4px_15px_rgba(245,158,11,0.3)] hover:scale-105 active:scale-95 uppercase tracking-wider"
            >
              <Heart className="w-4 h-4 fill-white animate-pulse" />
              Apoiar
            </button>
            <button 
              onClick={generatePDF}
              disabled={isGenerating}
              className="flex items-center gap-2 bg-slate-900 hover:bg-black text-white px-8 py-3 rounded-full font-bold transition-all disabled:opacity-50 active:scale-95 shadow-xl"
            >
              {isGenerating ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div> : <Download className="w-4 h-4" />}
              GERAR PDF
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden h-[calc(100vh-73px)]">
        <aside className="w-full md:w-80 bg-white border-r border-slate-200 p-6 overflow-y-auto shrink-0 z-20">
          {!image ? (
            <div className="h-full flex flex-col justify-center space-y-8 py-10 opacity-60">
              <div className="space-y-4">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">Bem-vindo</h2>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed mt-2">
                    Faça o upload de uma imagem ao lado para começar a configurar seu pôster em tamanho gigante.
                  </p>
                </div>
              </div>
              
              <div className="space-y-4 pt-6 border-t border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 font-bold text-xs">1</div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Escolha sua imagem</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 font-bold text-xs">2</div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Defina o tamanho</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 font-bold text-xs">3</div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Imprima e monte</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-left">
              <section className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex justify-between mb-2"><label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Colunas</label><span className="text-rose-600 font-black">{settings.cols}</span></div>
                  <input type="range" min="1" max="15" value={settings.cols} onChange={(e) => updateSetting('cols', parseInt(e.target.value))} className="w-full accent-rose-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                </div>
                
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex justify-between mb-2"><label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Linhas</label><span className="text-rose-600 font-black">{settings.rows}</span></div>
                  <input type="range" min="1" max="15" value={settings.rows} onChange={(e) => updateSetting('rows', parseInt(e.target.value))} className="w-full accent-rose-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer" />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Orientação</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => updateSetting('orientation', 'portrait')} className={`py-4 text-[10px] font-black uppercase rounded-xl border-2 transition-all ${settings.orientation === 'portrait' ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}>Vertical</button>
                  <button onClick={() => updateSetting('orientation', 'landscape')} className={`py-4 text-[10px] font-black uppercase rounded-xl border-2 transition-all ${settings.orientation === 'landscape' ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}>Horizontal</button>
                </div>
              </section>

              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                <button 
                  onClick={() => setShowPix(true)}
                  className="w-full flex items-center justify-between group"
                >
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-amber-600 fill-amber-600" />
                    <span className="text-[10px] font-black text-amber-900 uppercase">Apoiar Projeto</span>
                  </div>
                  <Sparkles className="w-3 h-3 text-amber-400 group-hover:rotate-12 transition-transform" />
                </button>
              </div>

              <button onClick={() => setImage(null)} className="w-full py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors flex items-center justify-center gap-2">
                <Trash2 className="w-3 h-3" /> Limpar Tudo
              </button>
            </div>
          )}
        </aside>

        <div className="flex-1 bg-slate-200 p-8 md:p-12 overflow-auto dashed-grid flex items-center justify-center relative">
          {image && drawMetrics ? (
            <div className="relative animate-in zoom-in duration-500">
              <div 
                className="relative bg-white p-2 shadow-[0_30px_60px_rgba(0,0,0,0.2)] rounded-sm transition-all duration-500"
                style={{
                  aspectRatio: `${drawMetrics.totalPosterWidth} / ${drawMetrics.totalPosterHeight}`,
                  width: drawMetrics.posterAspect > 1 ? '70vw' : 'auto',
                  height: drawMetrics.posterAspect > 1 ? 'auto' : '75vh',
                  maxWidth: '100%',
                  maxHeight: '100%'
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
                    <div 
                      key={i} 
                      className={`border border-white/30 transition-all duration-300 flex items-center justify-center relative overflow-hidden`}
                    >
                       <div className={`bg-black/30 backdrop-blur-sm text-white text-[10px] font-black w-8 h-8 flex items-center justify-center rounded-full border border-white/10 shadow-lg z-10`}>
                        {i + 1}
                       </div>
                    </div>
                  ))}
                </div>
                
                <img 
                  src={image.src} 
                  className="w-full h-full block" 
                  alt="Poster Preview"
                  style={{ objectFit: 'contain', padding: '4px' }}
                />
              </div>

              <div className="absolute -bottom-16 left-0 right-0 flex justify-center">
                <div className="bg-slate-900/90 backdrop-blur-xl px-8 py-3 rounded-full text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl border border-white/10 flex items-center gap-3">
                  <Maximize className="w-3 h-3 text-rose-500" />
                  {(drawMetrics.totalPosterWidth / 10).toFixed(1)} x {(drawMetrics.totalPosterHeight / 10).toFixed(1)} cm
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-8 w-full max-w-2xl px-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
              {/* Quadro de Upload Principal Único */}
              <div onClick={() => fileInputRef.current?.click()} className="w-full aspect-[21/9] sm:aspect-video bg-white rounded-[2.5rem] border-4 border-dashed border-rose-400/40 flex flex-col items-center justify-center gap-6 cursor-pointer hover:border-rose-500 hover:bg-white/80 transition-all shadow-2xl group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-rose-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center group-hover:scale-110 group-hover:bg-rose-100 transition-all relative z-10 shadow-inner">
                  <Upload className="w-10 h-10 text-rose-600" />
                </div>
                <div className="text-center relative z-10">
                  <p className="text-slate-800 font-black text-2xl uppercase italic tracking-tighter">Arraste ou clique aqui</p>
                  <p className="text-slate-400 font-bold text-sm tracking-tight">Crie seu pôster gigante agora em folhas A4</p>
                </div>
              </div>

              {/* Seção de Apoio Integrada */}
              <div className="w-full bg-gradient-to-r from-amber-400/10 via-amber-400/20 to-orange-400/10 backdrop-blur-md rounded-[2rem] p-1 border border-amber-200/50 shadow-xl relative group transition-transform hover:-translate-y-1">
                <div className="bg-white/80 rounded-[1.8rem] p-6 flex flex-col sm:flex-row items-center justify-between gap-6 overflow-hidden relative">
                   <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12 group-hover:scale-125 transition-transform">
                      <Star className="w-16 h-16 text-amber-500" />
                   </div>
                   
                   <div className="flex items-center gap-4 relative z-10">
                      <div className="bg-amber-100 p-4 rounded-2xl shadow-inner group-hover:rotate-6 transition-transform">
                        <Heart className="w-8 h-8 text-amber-600 fill-amber-600 animate-pulse" />
                      </div>
                      <div className="text-center sm:text-left">
                        <h4 className="text-slate-800 font-black uppercase italic text-lg tracking-tight leading-none">Apoie este projeto</h4>
                        <p className="text-slate-500 text-sm font-medium mt-1">Este site é gratuito. Considere apoiar se foi útil!</p>
                      </div>
                   </div>

                   <button 
                    onClick={() => setShowPix(true)}
                    className="whitespace-nowrap bg-slate-900 hover:bg-black text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 hover:shadow-amber-200/50 relative z-10 flex items-center gap-2"
                   >
                     Ver Chave Pix <Sparkles className="w-4 h-4 text-amber-400" />
                   </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Modal do Pix */}
          {showPix && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
              <div className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full shadow-[0_32px_64px_rgba(0,0,0,0.3)] space-y-6 relative animate-in zoom-in slide-in-from-bottom-8 duration-500">
                <button 
                  onClick={() => setShowPix(false)}
                  className="absolute top-6 right-6 text-slate-300 hover:text-rose-500 transition-colors p-2"
                >
                  <Trash2 className="w-5 h-5" />
                </button>

                <div className="text-center space-y-2 pt-4">
                  <div className="w-16 h-16 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                    <Heart className="w-8 h-8 text-amber-500 fill-amber-500 animate-pulse" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 uppercase italic tracking-tight">Apoie este Projeto</h3>
                  <p className="text-slate-500 text-sm font-medium px-4 leading-relaxed">
                    Sua doação ajuda a manter o servidor online e gratuito para todos!
                  </p>
                </div>

                <div className="bg-slate-50 p-6 rounded-[2rem] flex flex-col items-center space-y-4 border border-slate-100 shadow-inner">
                  <div className="w-48 h-48 bg-white p-3 rounded-3xl border border-slate-200 flex items-center justify-center overflow-hidden shadow-lg group">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(PIX_KEY)}`} 
                      alt="QR Code Pix"
                      className="w-full h-full group-hover:scale-105 transition-transform"
                    />
                  </div>
                  
                  <div className="w-full space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block text-center">Clique no botão para copiar a chave</label>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-white border border-slate-200 rounded-2xl px-4 py-4 text-[10px] font-mono text-slate-600 overflow-hidden truncate">
                        {PIX_KEY}
                      </div>
                      <button 
                        onClick={copyPix}
                        className={`px-5 rounded-2xl transition-all shadow-lg ${copied ? 'bg-green-500 text-white' : 'bg-slate-900 text-white hover:bg-black active:scale-90'}`}
                      >
                        {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setShowPix(false)}
                  className="w-full py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-800 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
          
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
          <span>A4poster v2.7</span>
        </div>
        
        <div className="flex gap-4 items-center">
          <button 
            onClick={() => setShowPix(true)}
            className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-full hover:bg-amber-100 transition-all border border-amber-200 shadow-sm group"
          >
            <Heart className="w-3.5 h-3.5 fill-amber-700 group-hover:scale-125 transition-transform" /> 
            Apoie este projeto
          </button>
          <span className="hidden md:inline-block">Código Aberto & Gratuito</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
