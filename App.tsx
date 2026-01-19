
import React, { useState, useRef, useMemo } from 'react';
import { Upload, Settings, Download, Layers, Maximize, Trash2, Scissors, Info, MousePointer2, CheckCircle2, Heart, Copy, Check } from 'lucide-react';
import { TileSettings, ImageMetadata } from './types';
import { DEFAULT_SETTINGS, PAPER_SIZES } from './constants';

const App: React.FC = () => {
  const [image, setImage] = useState<ImageMetadata | null>(null);
  const [settings, setSettings] = useState<TileSettings>(DEFAULT_SETTINGS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hoveredTile, setHoveredTile] = useState<number | null>(null);
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

    const efficiency = ((finalDrawW * finalDrawH) / (totalPosterWidth * totalPosterHeight)) * 100;

    return { 
      finalDrawW, finalDrawH, 
      offsetX, offsetY, 
      efficiency, 
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
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowPix(true)}
              className="hidden sm:flex items-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-700 px-4 py-2.5 rounded-full font-bold transition-all text-xs"
            >
              <Heart className="w-3.5 h-3.5 fill-amber-700" />
              APOIAR
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
            <div className="text-center py-10 space-y-4">
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto">
                <Upload className="w-8 h-8 text-rose-300" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">Carregar Imagem</h2>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-rose-600 text-white px-6 py-4 rounded-2xl font-bold hover:bg-rose-700 transition-all w-full shadow-lg shadow-rose-100"
              >
                Selecionar Arquivo
              </button>
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
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Página</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => updateSetting('orientation', 'portrait')} className={`py-4 text-[10px] font-black uppercase rounded-xl border-2 transition-all ${settings.orientation === 'portrait' ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}>Vertical</button>
                  <button onClick={() => updateSetting('orientation', 'landscape')} className={`py-4 text-[10px] font-black uppercase rounded-xl border-2 transition-all ${settings.orientation === 'landscape' ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-slate-100'}`}>Horizontal</button>
                </div>
              </section>

              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="w-4 h-4 text-amber-600 fill-amber-600" />
                  <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider">Apoie este projeto</span>
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed mb-3">Este site é gratuito. Se foi útil, considere apoiar para mantê-lo online.</p>
                <button 
                  onClick={() => setShowPix(true)}
                  className="w-full bg-amber-600 text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-amber-700 transition-colors shadow-sm"
                >
                  Ver Pix de Apoio
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
            <div onClick={() => fileInputRef.current?.click()} className="max-w-xl w-full aspect-video bg-white rounded-[3rem] border-4 border-dashed border-slate-300 flex flex-col items-center justify-center gap-6 cursor-pointer hover:border-rose-400 hover:bg-white/50 transition-all shadow-xl group">
              <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <Upload className="w-10 h-10 text-rose-600" />
              </div>
              <div className="text-center">
                <p className="text-slate-800 font-black text-2xl uppercase italic tracking-tighter">Arraste ou clique aqui</p>
                <p className="text-slate-400 font-bold text-sm">Crie seu poster gigante agora</p>
              </div>
            </div>
          )}
          
          {/* Modal do Pix */}
          {showPix && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl space-y-6 relative animate-in zoom-in slide-in-from-bottom-4">
                <button 
                  onClick={() => setShowPix(false)}
                  className="absolute top-6 right-6 text-slate-400 hover:text-slate-800 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>

                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Heart className="w-6 h-6 text-amber-600 fill-amber-600" />
                  </div>
                  <h3 className="text-xl font-black text-slate-800 uppercase italic">Apoie o Projeto</h3>
                  <p className="text-slate-500 text-xs font-medium px-4">Este site é gratuito. Se ele te ajudou, considere fazer uma doação de qualquer valor.</p>
                </div>

                <div className="bg-slate-50 p-6 rounded-3xl flex flex-col items-center space-y-4 border border-slate-100">
                  {/* QR Code Placeholder/Generated via API */}
                  <div className="w-48 h-48 bg-white p-2 rounded-2xl border border-slate-200 flex items-center justify-center overflow-hidden">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(PIX_KEY)}`} 
                      alt="QR Code Pix"
                      className="w-full h-full"
                    />
                  </div>
                  
                  <div className="w-full space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block text-center">Chave Pix (Copiar e Colar)</label>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-[10px] font-mono text-slate-600 overflow-hidden truncate">
                        {PIX_KEY}
                      </div>
                      <button 
                        onClick={copyPix}
                        className={`p-3 rounded-xl transition-all ${copied ? 'bg-green-500 text-white' : 'bg-slate-900 text-white hover:bg-black'}`}
                      >
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
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
          <span>A4poster v2.4</span>
        </div>
        
        <div className="flex gap-8 items-center text-slate-600">
          <button 
            onClick={() => setShowPix(true)}
            className="flex items-center gap-2 hover:text-amber-600 transition-colors group"
          >
            <Heart className="w-3.5 h-3.5 group-hover:fill-amber-600" /> 
            APOIE ESTE PROJETO
          </button>
          <span className="hidden md:flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Preservação de Escala</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
