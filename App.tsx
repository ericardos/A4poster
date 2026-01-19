
import React, { useState, useRef, useMemo } from 'react';
import { Upload, Settings, Download, Layers, Maximize, Trash2, Scissors, Info, MousePointer2, CheckCircle2 } from 'lucide-react';
import { TileSettings, ImageMetadata } from './types';
import { DEFAULT_SETTINGS, PAPER_SIZES } from './constants';

const App: React.FC = () => {
  const [image, setImage] = useState<ImageMetadata | null>(null);
  const [settings, setSettings] = useState<TileSettings>(DEFAULT_SETTINGS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hoveredTile, setHoveredTile] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cálculo de métricas que garante que a grade e a imagem aproveitem o máximo da folha na orientação escolhida
  const drawMetrics = useMemo(() => {
    if (!image) return null;
    
    const paper = PAPER_SIZES[settings.paperSize];
    // pWidth e pHeight são as dimensões da FOLHA INDIVIDUAL considerando a rotação
    const pWidth = settings.orientation === 'portrait' ? paper.width : paper.height;
    const pHeight = settings.orientation === 'portrait' ? paper.height : paper.width;

    // A largura e altura TOTAL do pôster montado (em mm)
    // Se a folha está horizontal, o totalPosterWidth cresce mais rápido com as colunas
    const totalPosterWidth = pWidth * settings.cols;
    const totalPosterHeight = pHeight * settings.rows;
    
    const posterAspect = totalPosterWidth / totalPosterHeight;
    const imageAspect = image.width / image.height;

    let finalDrawW, finalDrawH, offsetX, offsetY;
    
    // Ajustamos a imagem dentro do "super-bloco" formado por todas as folhas
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
      const { pWidth, pHeight, finalDrawW, finalDrawH, offsetX, offsetY } = drawMetrics;

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
            
            // Proporção de desenho por folha
            const drawW = finalDrawW / settings.cols;
            const drawH = finalDrawH / settings.rows;
            
            // Centralização local baseada no offset global
            const localOffsetX = (pWidth - drawW) / 2;
            const localOffsetY = (pHeight - drawH) / 2;

            pdf.addImage(imgData, 'PNG', localOffsetX, localOffsetY, drawW, drawH);
            
            pdf.setDrawColor(220, 220, 220);
            pdf.setLineWidth(0.1);
            pdf.rect(localOffsetX, localOffsetY, drawW, drawH);
            
            pdf.setFontSize(6);
            pdf.setTextColor(150);
            pdf.text(`Página ${r * settings.cols + c + 1} | Linha ${r+1}, Col ${c+1} | ${settings.orientation.toUpperCase()}`, pWidth/2, pHeight - 5, { align: 'center' });
          }
        }
      }

      pdf.save(`A4poster-${settings.orientation}.pdf`);
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
          <button 
            onClick={generatePDF}
            disabled={isGenerating}
            className="flex items-center gap-2 bg-slate-900 hover:bg-black text-white px-8 py-3 rounded-full font-bold transition-all disabled:opacity-50 active:scale-95 shadow-xl"
          >
            {isGenerating ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div> : <Download className="w-4 h-4" />}
            GERAR PDF {settings.orientation === 'portrait' ? 'VERTICAL' : 'HORIZONTAL'}
          </button>
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
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Orientação da Página</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => updateSetting('orientation', 'portrait')} className={`py-4 text-[10px] font-black uppercase rounded-xl border-2 transition-all ${settings.orientation === 'portrait' ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-rose-200'}`}>Vertical</button>
                  <button onClick={() => updateSetting('orientation', 'landscape')} className={`py-4 text-[10px] font-black uppercase rounded-xl border-2 transition-all ${settings.orientation === 'landscape' ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-rose-200'}`}>Horizontal</button>
                </div>
              </section>

              {drawMetrics && (
                <div className="bg-slate-900 rounded-3xl p-5 space-y-3 shadow-xl text-white">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[9px] font-black text-rose-400 uppercase tracking-widest">Aproveitamento</h4>
                    <span className="text-[10px] font-black bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full">
                      {drawMetrics.efficiency.toFixed(0)}% Ocupado
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px] font-medium opacity-70">
                      <span>Largura Total</span>
                      <span>{(drawMetrics.totalPosterWidth / 10).toFixed(1)} cm</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-medium opacity-70">
                      <span>Altura Total</span>
                      <span>{(drawMetrics.totalPosterHeight / 10).toFixed(1)} cm</span>
                    </div>
                  </div>
                </div>
              )}
              
              <button onClick={() => setImage(null)} className="w-full py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors flex items-center justify-center gap-2">
                <Trash2 className="w-3 h-3" /> Limpar Projeto
              </button>
            </div>
          )}
        </aside>

        <div className="flex-1 bg-slate-200 p-8 md:p-12 overflow-auto dashed-grid flex items-center justify-center">
          {image && drawMetrics ? (
            <div className="relative animate-in zoom-in duration-500">
              {/* Container de Preview que respeita a proporção REAL do conjunto de folhas */}
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
                {/* Grade de Ladrilhos com Rotação de Orientação Visual */}
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
                      onMouseEnter={() => setHoveredTile(i)}
                      onMouseLeave={() => setHoveredTile(null)}
                      className={`border border-white/30 pointer-events-auto transition-all duration-300 ${hoveredTile === i ? 'bg-rose-500/10' : ''} flex items-center justify-center relative overflow-hidden`}
                    >
                       <div className={`transition-all duration-300 ${hoveredTile === i ? 'scale-110 bg-rose-600' : 'bg-black/30'} backdrop-blur-sm text-white text-[10px] font-black w-8 h-8 flex items-center justify-center rounded-full border border-white/10 shadow-lg z-10`}>
                        {i + 1}
                       </div>
                       {/* Linhas cruzadas para visualização de centro de folha */}
                       <div className="absolute inset-0 opacity-5 bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] bg-[size:50%_50%]"></div>
                    </div>
                  ))}
                </div>
                
                <img 
                  src={image.src} 
                  className="w-full h-full block" 
                  alt="Poster Preview"
                  style={{ 
                    objectFit: 'contain',
                    // Garante que a imagem preencha o máximo da grade sem sobras
                    padding: '4px'
                  }}
                />
              </div>

              <div className="absolute -bottom-16 left-0 right-0 flex justify-center">
                <div className="bg-slate-900/90 backdrop-blur-xl px-8 py-3 rounded-full text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl border border-white/10 flex items-center gap-3">
                  <Maximize className="w-3 h-3 text-rose-500" />
                  Pôster Final: {(drawMetrics.totalPosterWidth / 10).toFixed(1)} x {(drawMetrics.totalPosterHeight / 10).toFixed(1)} cm
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
                <p className="text-slate-400 font-bold text-sm">JPG, PNG ou WEBP para transformar em poster</p>
              </div>
            </div>
          )}
          
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 px-8 py-4 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse"></div>
          <span>A4poster Engine v2.3</span>
        </div>
        <div className="flex gap-8 text-slate-600">
          <span className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Grade {settings.orientation === 'portrait' ? 'Vertical' : 'Horizontal'}</span>
          <span className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> Proporção Preservada</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
