import { open } from "@tauri-apps/plugin-dialog";

import type { VideoLayer } from "../../types/videoTemplate";

import { LAYER_LABELS } from "../../types/videoTemplate";

import { normalizeVideoRect } from "../../lib/videoTemplateRect";



interface Props {

  layer: VideoLayer | null;

  canvasWidth: number;

  canvasHeight: number;

  onChange: (patch: Partial<VideoLayer>) => void;

}



export default function VideoLayerInspector({ layer, canvasWidth, canvasHeight, onChange }: Props) {

  if (!layer) {

    return (

      <div className="text-xs text-muted p-3 border border-border rounded-lg bg-panel2/40">

        Wybierz warstwę na canvasie, aby edytować właściwości.

      </div>

    );

  }



  const setRect = (key: keyof VideoLayer["rect"], value: number) => {

    const rect = normalizeVideoRect(

      { ...layer.rect, [key]: value },

      canvasWidth,

      canvasHeight,

    );

    onChange({ rect } as Partial<VideoLayer>);

  };



  const pickImage = async () => {

    const selected = await open({

      multiple: false,

      filters: [{ name: "Obrazy", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],

    });

    if (typeof selected === "string") {

      onChange({ imagePath: selected } as Partial<VideoLayer>);

    }

  };



  const pickVideo = async () => {

    const selected = await open({

      multiple: false,

      filters: [{ name: "Wideo (MP4 / WebM / MOV)", extensions: ["mp4", "webm", "mov", "mkv"] }],

    });

    if (typeof selected === "string") {

      onChange({ videoPath: selected } as Partial<VideoLayer>);

    }

  };



  return (

    <div className="video-layer-inspector flex flex-col gap-3 text-xs border border-border rounded-lg p-3 bg-panel2/40">

      <h4 className="font-semibold text-sm">{LAYER_LABELS[layer.type]}</h4>



      <label className="flex items-center gap-2">

        <input

          type="checkbox"

          checked={layer.visible}

          onChange={(e) => onChange({ visible: e.target.checked } as Partial<VideoLayer>)}

        />

        Widoczna

      </label>



      <div className="grid grid-cols-2 gap-2">

        {(["x", "y", "width", "height"] as const).map((key) => (

          <label key={key} className="flex flex-col gap-0.5">

            <span className="text-muted uppercase text-[10px]">{key}</span>

            <input

              type="number"

              step={1}

              min={key === "x" || key === "y" ? 0 : 8}

              className="input text-xs py-1"

              value={Math.round(layer.rect[key])}

              onChange={(e) => setRect(key, Number(e.target.value) || 0)}

            />

          </label>

        ))}

      </div>



      {layer.type === "cover" && (

        <>

          <label className="flex flex-col gap-0.5">

            <span className="text-muted">Źródło okładki</span>

            <select

              className="input text-xs py-1"

              value={layer.mode}

              onChange={(e) => onChange({ mode: e.target.value } as Partial<VideoLayer>)}

            >

              <option value="profile">Avatar profilu</option>

              <option value="generation_color">Kolor generacji</option>

              <option value="fixed_image">Stały obraz</option>

            </select>

          </label>

          <label className="flex flex-col gap-0.5">

            <span className="text-muted">Dopasowanie (object-fit)</span>

            <select

              className="input text-xs py-1"

              value={layer.objectFit}

              onChange={(e) =>

                onChange({ objectFit: e.target.value as "contain" | "cover" | "fill" } as Partial<VideoLayer>)

              }

            >

              <option value="contain">Contain — całość w ramce</option>

              <option value="cover">Cover — wypełnij, przytnij</option>

              <option value="fill">Fill — rozciągnij do ramki</option>

            </select>

          </label>

        </>

      )}



      {layer.type === "footer" && (

        <>

          <label className="flex flex-col gap-0.5">

            <span className="text-muted">Szablon stopki</span>

            <input

              className="input text-xs"

              value={layer.template}

              onChange={(e) => onChange({ template: e.target.value } as Partial<VideoLayer>)}

            />

          </label>

          <p className="text-[10px] text-muted">

            Zmienne: {"{{voice}} {{model}} {{duration}} {{title}} {{date}}"}

          </p>

          <label className="flex flex-col gap-0.5">

            <span className="text-muted">Wyrównanie</span>

            <select

              className="input text-xs py-1"

              value={layer.align}

              onChange={(e) =>

                onChange({ align: e.target.value as "left" | "center" | "right" } as Partial<VideoLayer>)

              }

            >

              <option value="left">Lewo</option>

              <option value="center">Środek</option>

              <option value="right">Prawo</option>

            </select>

          </label>

          <label className="flex flex-col gap-0.5">

            <span className="text-muted">Rozmiar czcionki</span>

            <input

              type="number"

              className="input text-xs py-1"

              value={layer.fontSize}

              onChange={(e) =>

                onChange({ fontSize: Number(e.target.value) || 18 } as Partial<VideoLayer>)

              }

            />

          </label>

        </>

      )}



      {layer.type === "karaoke" && (

        <>

          <label className="flex flex-col gap-0.5">

            <span className="text-muted">Źródło napisów</span>

            <select

              className="input text-xs py-1"

              value={layer.source}

              onChange={(e) => onChange({ source: e.target.value } as Partial<VideoLayer>)}

            >

              <option value="minimax_json">MiniMax JSON</option>

              <option value="estimated_text">Szacowanie z tekstu</option>

              <option value="static_title">Statyczny tytuł</option>

            </select>

          </label>

          <label className="flex flex-col gap-0.5">

            <span className="text-muted">Przewijanie tekstu</span>

            <select

              className="input text-xs py-1"

              value={layer.scrollMode ?? "classic"}

              onChange={(e) => onChange({ scrollMode: e.target.value } as Partial<VideoLayer>)}

            >

              <option value="classic">Jedna linia — karaoke słowo po słowie</option>

              <option value="line-focus">Linijka po linijce — aktywna na środku</option>

              <option value="smooth">Wyjustowany blok — płynne przewijanie</option>

            </select>

          </label>

          <p className="text-[10px] text-muted leading-snug">

            {layer.scrollMode === "line-focus"

              ? "Aktywna linia na środku ramki, sąsiednie przygaszone; skok o jedną linijkę w górę. Powiększ ramkę karaoke, żeby widać było 3–5 linii."

              : layer.scrollMode === "smooth"

                ? "Tekst wypełnia szerokość bez pustych przerw i jedzie płynnie w górę w rytm nagrania."

                : "Jedna linia na dole ramki, złote wypełnienie kolejnych słów."}

          </p>

          <label className="flex flex-col gap-0.5">

            <span className="text-muted">Rozmiar czcionki</span>

            <input

              type="number"

              className="input text-xs py-1"

              value={layer.fontSize}

              onChange={(e) =>

                onChange({ fontSize: Number(e.target.value) || 40 } as Partial<VideoLayer>)

              }

            />

          </label>

        </>

      )}



      {layer.type === "watermark" && (

        <>

          <label className="flex flex-col gap-0.5">

            <span className="text-muted">Tekst</span>

            <input

              className="input text-xs"

              value={layer.text}

              onChange={(e) => onChange({ text: e.target.value } as Partial<VideoLayer>)}

            />

          </label>

          <label className="flex flex-col gap-0.5">

            <span className="text-muted">Przezroczystość</span>

            <input

              type="range"

              min={0.05}

              max={1}

              step={0.05}

              value={layer.opacity}

              onChange={(e) =>

                onChange({ opacity: Number(e.target.value) } as Partial<VideoLayer>)

              }

            />

          </label>

        </>

      )}



      {layer.type === "image" && (

        <>

          <label className="flex flex-col gap-1">

            <span className="text-muted">Plik obrazu</span>

            <button type="button" className="btn text-xs py-1" onClick={() => void pickImage()}>

              Wybierz PNG/JPG…

            </button>

            {layer.imagePath && (

              <span className="text-[10px] text-muted truncate" title={layer.imagePath}>

                {layer.imagePath.split(/[/\\]/).pop()}

              </span>

            )}

          </label>

          <label className="flex flex-col gap-0.5">

            <span className="text-muted">Dopasowanie</span>

            <select

              className="input text-xs py-1"

              value={layer.objectFit}

              onChange={(e) =>

                onChange({ objectFit: e.target.value as "contain" | "cover" | "fill" } as Partial<VideoLayer>)

              }

            >

              <option value="contain">Contain</option>

              <option value="cover">Cover</option>

              <option value="fill">Fill</option>

            </select>

          </label>

          <label className="flex flex-col gap-0.5">

            <span className="text-muted">Przezroczystość</span>

            <input

              type="range"

              min={0.05}

              max={1}

              step={0.05}

              value={layer.opacity}

              onChange={(e) =>

                onChange({ opacity: Number(e.target.value) } as Partial<VideoLayer>)

              }

            />

          </label>

        </>

      )}



      {layer.type === "shape" && (

        <>

          <label className="flex flex-col gap-0.5">

            <span className="text-muted">Typ kształtu</span>

            <select

              className="input text-xs py-1"

              value={layer.shapeKind}

              onChange={(e) =>

                onChange({ shapeKind: e.target.value as "rect" | "ellipse" } as Partial<VideoLayer>)

              }

            >

              <option value="rect">Prostokąt</option>

              <option value="ellipse">Elipsa (podgląd; render: prostokąt)</option>

            </select>

          </label>

          <label className="flex flex-col gap-0.5">

            <span className="text-muted">Wypełnienie</span>

            <input

              type="color"

              className="h-8 w-full cursor-pointer"

              value={layer.fill.slice(0, 7)}

              onChange={(e) => onChange({ fill: e.target.value } as Partial<VideoLayer>)}

            />

          </label>

          <label className="flex flex-col gap-0.5">

            <span className="text-muted">Obrys</span>

            <input

              type="color"

              className="h-8 w-full cursor-pointer"

              value={layer.stroke.slice(0, 7)}

              onChange={(e) => onChange({ stroke: e.target.value } as Partial<VideoLayer>)}

            />

          </label>

          <label className="flex flex-col gap-0.5">

            <span className="text-muted">Grubość obrysu (px)</span>

            <input

              type="number"

              min={0}

              className="input text-xs py-1"

              value={layer.strokeWidth}

              onChange={(e) =>

                onChange({ strokeWidth: Number(e.target.value) || 0 } as Partial<VideoLayer>)

              }

            />

          </label>
<label className="flex flex-col gap-0.5">

            <span className="text-muted">Przezroczystość</span>

            <input

              type="range"

              min={0.05}

              max={1}

              step={0.05}

              value={layer.opacity}

              onChange={(e) =>

                onChange({ opacity: Number(e.target.value) } as Partial<VideoLayer>)

              }

            />

          </label>

        </>

      )}

      {layer.type === "videoLoop" && (

        <>

          <label className="flex flex-col gap-1">

            <span className="text-muted">Plik animacji (MP4 / WebM / MOV)</span>

            <button type="button" className="btn text-xs py-1" onClick={() => void pickVideo()}>

              Wybierz MP4…

            </button>

            {layer.videoPath && (

              <span className="text-[10px] text-muted truncate" title={layer.videoPath}>

                {layer.videoPath.split(/[/\\]/).pop()}

              </span>

            )}

          </label>

          <p className="text-[10px] text-muted leading-snug">

            Domyślna ścieżka wskazuje na dołączony <code>tshub_baner.mp4</code> w pakiecie
            Tauri (bundled resource). Dla źródeł z przezroczystością (alpha) użyj PNG→MP4.
          </p>

          <label className="flex flex-col gap-0.5">

            <span className="text-muted">

              Obrót (obroty/s) — 0 = statyczny
            </span>

            <input

              type="number"

              step={0.05}

              className="input text-xs py-1"

              value={layer.rotationSpeed}

              onChange={(e) =>

                onChange({

                  rotationSpeed: Math.max(0, Number(e.target.value) || 0),

                } as Partial<VideoLayer>)

              }

            />

          </label>

          <label className="flex flex-col gap-0.5">

            <span className="text-muted">Przezroczystość</span>

            <input

              type="range"

              min={0.05}

              max={1}

              step={0.05}

              value={layer.opacity}

              onChange={(e) =>

                onChange({ opacity: Number(e.target.value) } as Partial<VideoLayer>)

              }

            />

          </label>

        </>

      )}



      {layer.type === "customText" && (

        <>

          <label className="flex flex-col gap-0.5">

            <span className="text-muted">Tekst (wiele linii)</span>

            <textarea

              className="input text-xs py-1 min-h-[80px] resize-y"

              value={layer.text}

              placeholder="Wpisz tekst…"

              onChange={(e) =>

                onChange({ text: e.target.value } as Partial<VideoLayer>)

              }

            />

          </label>

          <label className="flex flex-col gap-0.5">

            <span className="text-muted">Czcionka</span>

            <input

              className="input text-xs"

              value={layer.fontName}

              onChange={(e) =>

                onChange({ fontName: e.target.value || "Arial" } as Partial<VideoLayer>)

              }

            />

          </label>

          <label className="flex flex-col gap-0.5">

            <span className="text-muted">Rozmiar (px)</span>

            <input

              type="number"

              min={8}

              className="input text-xs py-1"

              value={layer.fontSize}

              onChange={(e) =>

                onChange({ fontSize: Number(e.target.value) || 36 } as Partial<VideoLayer>)

              }

            />

          </label>

          <div className="flex items-center gap-3 flex-wrap">

            <label className="flex items-center gap-1.5">

              <input

                type="checkbox"

                checked={layer.bold}

                onChange={(e) =>

                  onChange({ bold: e.target.checked } as Partial<VideoLayer>)

                }

              />

              <span className="text-xs">Pogrubienie</span>

            </label>

            <label className="flex items-center gap-1.5">

              <input

                type="checkbox"

                checked={layer.italic}

                onChange={(e) =>

                  onChange({ italic: e.target.checked } as Partial<VideoLayer>)

                }

              />

              <span className="text-xs">Kursywa</span>

            </label>

            <label className="flex items-center gap-1.5">

              <input

                type="checkbox"

                checked={layer.background}

                onChange={(e) =>

                  onChange({ background: e.target.checked } as Partial<VideoLayer>)

                }

              />

              <span className="text-xs">Tło</span>

            </label>

          </div>

          <label className="flex flex-col gap-0.5">

            <span className="text-muted">Kolor tekstu</span>

            <input

              type="color"

              className="h-8 w-full cursor-pointer"

              value={layer.color.slice(0, 7)}

              onChange={(e) =>

                onChange({ color: e.target.value } as Partial<VideoLayer>)

              }

            />

          </label>

          {layer.background && (

            <>

              <label className="flex flex-col gap-0.5">

                <span className="text-muted">Kolor tła</span>

                <input

                  type="color"

                  className="h-8 w-full cursor-pointer"

                  value={layer.backgroundColor.slice(0, 7)}

                  onChange={(e) =>

                    onChange({ backgroundColor: e.target.value } as Partial<VideoLayer>)

                  }

                />

              </label>

              <label className="flex flex-col gap-0.5">

                <span className="text-muted">Przezroczystość tła</span>

                <input

                  type="range"

                  min={0}

                  max={1}

                  step={0.05}

                  value={layer.backgroundOpacity}

                  onChange={(e) =>

                    onChange({ backgroundOpacity: Number(e.target.value) } as Partial<VideoLayer>)

                  }

                />

              </label>

            </>

          )}

          <div className="grid grid-cols-2 gap-2">

            <label className="flex flex-col gap-0.5">

              <span className="text-muted">Wyr. poziome</span>

              <select

                className="input text-xs py-1"

                value={layer.align}

                onChange={(e) =>

                  onChange({

                    align: e.target.value as "left" | "center" | "right",

                  } as Partial<VideoLayer>)

                }

              >

                <option value="left">Lewo</option>

                <option value="center">Środek</option>

                <option value="right">Prawo</option>

              </select>

            </label>

            <label className="flex flex-col gap-0.5">

              <span className="text-muted">Wyr. pionowe</span>

              <select

                className="input text-xs py-1"

                value={layer.verticalAlign}

                onChange={(e) =>

                  onChange({

                    verticalAlign: e.target.value as "top" | "middle" | "bottom",

                  } as Partial<VideoLayer>)

                }

              >

                <option value="top">Góra</option>

                <option value="middle">Środek</option>

                <option value="bottom">Dół</option>

              </select>

            </label>

          </div>

        </>

      )}

    </div>

  );



}
