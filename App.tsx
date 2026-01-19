
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
    // pWidth e pHeight são as dimensões da FOLHA INDIVIDUAL
    const pWidth = settings.orientation === 'portrait' ? paper.width : paper.height;
    const pHeight = settings.orientation === 'portrait' ? paper.height : paper.width;

    // A largura e altura TOTAL do pôster montado (em mm)
    const totalPosterWidth = pWidth * settings.cols;
    const totalPosterHeight = pHeight * settings.rows;
    
    const posterAspect = totalPosterWidth / totalPosterHeight;
    const imageAspect = image.width / image.height;

    let finalDrawW, finalDrawH, offsetX, offsetY;
    
    // Ajustamos a imagem dentro do "super-bloco" formado por todas as folhas
    if (imageAspect > posterAspect) {
      // Imagem é mais larga que a grade de folhas
      finalDrawW = totalPosterWidth;
      finalDrawH = totalPosterWidth / imageAspect;
      offsetX = 0;
      offsetY = (totalPosterHeight - finalDrawH) / 2;
    } else {
      // Imagem é mais alta que a grade de folhas
      finalDrawH = totalPosterHeight;
      finalDrawW = totalPosterHeight * imageAspect;
      offsetY = 0;
      offsetX = (totalPosterWidth - finalDrawW) / 2;
    }

    // Eficiência baseada na área ocupada da grade total
    const efficiency = ((finalDrawW * finalDrawH) / (totalPosterWidth * totalPosterHeight)) * 100;

    return { 
      finalDrawW, finalDrawH, 
      offsetX, offsetY, 
      efficiency, 
      pWidth, pHeight,
      totalPosterWidth, totalPosterHeight 
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
        
        // Sugestão inicial inteligente
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
          // Precisamos capturar a porção exata da imagem que cabe NESTA folha
          // A largura da imagem que corresponde a uma folha na grade:
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
            
            // Calculamos o tamanho do desenho para esta folha individual (mantendo a proporção calculada na grade)
            const drawW = finalDrawW / settings.cols;
            const drawH = finalDrawH / settings.rows;
            const drawX = offsetX / settings.cols;
            const drawY = offsetY / settings.rows;

            pdf.addImage(imgData, 'PNG', drawX, drawY, drawW, drawH);
            
            pdf.setDrawColor(240, 240, 240);
            pdf.setLineWidth(0.05);
            pdf.rect(drawX, drawY, drawW, drawH);
            
            pdf.setFontSize(5);
            pdf.setTextColor(180);
            pdf.text(`Folha ${r * settings.cols + c + 1} | Linha ${r+1}, Col ${c+1}`, pWidth/2, pHeight - 4, { align: 'center' });
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
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
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
            GERAR PDF
          </button>
        )}
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden h-[calc(100vh-73px)]">
        <aside className="w-full md:w-80 bg-white border-r border-slate-200 p-6 overflow-y-auto shrink-0 z-20">
          {!image ? (
            <div className="text-center py-10 space-y-4">
              <Upload className="w-10 h-10 text-rose-300 mx-auto" />
              <h2 className="text-lg font-bold text-slate-800">Novo Projeto</h2>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-rose-600 text-white px-6 py-4 rounded-2xl font-bold hover:bg-rose-700 transition-all w-full"
              >
                Escolher Imagem
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-left">
              <section className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex justify-between mb-2"><label className="text-[10px] font-bold uppercase text-slate-500">Colunas</label><span className="text-rose-600 font-black">{settings.cols}</span></div>
                  <input type="range" min="1" max="15" value={settings.cols} onChange={(e) => updateSetting('cols', parseInt(e.target.value))} className="w-full accent-rose-600" />
                </div>
                
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex justify-between mb-2"><label className="text-[10px] font-bold uppercase text-slate-500">Linhas</label><span className="text-rose-600 font-black">{settings.rows}</span></div>
                  <input type="range" min="1" max="15" value={settings.rows} onChange={(e) => updateSetting('rows', parseInt(e.target.value))} className="w-full accent-rose-600" />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Orientação da Folha</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => updateSetting('orientation', 'portrait')} className={`py-4 text-[10px] font-black uppercase rounded-xl border-2 transition-all ${settings.orientation === 'portrait' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100'}`}>Vertical</button>
                  <button onClick={() => updateSetting('orientation', 'landscape')} className={`py-4 text-[10px] font-black uppercase rounded-xl border-2 transition-all ${settings.orientation === 'landscape' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-100'}`}>Horizontal</button>
                </div>
              </section>

              {drawMetrics && (
                <div className="bg-white rounded-3xl p-5 border-2 border-slate-100 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Eficiência</h4>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${drawMetrics.efficiency > 80 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {drawMetrics.efficiency.toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-500">O aproveitamento da imagem melhora quando a grade {settings.cols}x{settings.rows} se aproxima do formato da foto.</p>
                </div>
              )}
            </div>
          )}
        </aside>

        <div className="flex-1 bg-slate-200 p-8 md:p-12 overflow-auto dashed-grid flex items-center justify-center">
          {image && drawMetrics ? (
            <div className="relative animate-in zoom-in duration-300">
              {/* Recalculamos a proporção da grade para o preview */}
              <div 
                className="relative bg-white p-1 shadow-2xl rounded-sm transition-all duration-500"
                style={{
                  width: 'fit-content',
                  height: 'fit-content'
                }}
              >
                {/* Grade Dinâmica sobre a imagem */}
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
                      className={`border border-white/40 pointer-events-auto transition-all ${hoveredTile === i ? 'bg-rose-500/20' : ''} flex items-center justify-center`}
                    >
                       <div className={`transition-all ${hoveredTile === i ? 'scale-125 bg-rose-600' : 'bg-black/40'} text-white text-[9px] font-black w-7 h-7 flex items-center justify-center rounded-full border border-white/20 shadow-lg`}>
                        {i + 1}
                       </div>
                    </div>
                  ))}
                </div>
                
                <img 
                  src={image.src} 
                  className="max-h-[70vh] w-auto block" 
                  alt="Poster Preview"
                  style={{ 
                    // Garante que a imagem se ajuste à proporção da grade sem distorcer
                    objectFit: 'contain'
                  }}
                />
              </div>

              <div className="absolute -bottom-16 left-0 right-0 flex justify-center">
                <div className="bg-slate-900 px-6 py-2.5 rounded-full text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl">
                  Dimensões: {(drawMetrics.totalPosterWidth / 10).toFixed(1)} x {(drawMetrics.totalPosterHeight / 10).toFixed(1)} cm
                </div>
              </div>
            </div>
          ) : (
            <div onClick={() => fileInputRef.current?.click()} className="max-w-xl w-full aspect-video bg-white rounded-[3rem] border-4 border-dashed border-slate-300 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-rose-400 transition-all shadow-xl">
              <Upload className="w-8 h-8 text-rose-600" />
              <p className="text-slate-800 font-black text-xl uppercase italic">Carregar Imagem</p>
            </div>
          )}
          
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
        </div>
      </main>

      <footer className="bg-white border-t border-slate-200 px-8 py-3 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
        <span>A4poster Engine v2.2</span>
        <div className="flex gap-6 text-slate-600">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-500" /> Grade {settings.orientation === 'portrait' ? 'Vertical' : 'Horizontal'}</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-green-500" /> Proporção Real</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
