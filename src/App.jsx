import { useEffect, useMemo, useRef, useState } from "react";

export default function App() {
  const [imageSrc, setImageSrc] = useState(null);
  const [result, setResult] = useState(null);
  const [previewName, setPreviewName] = useState("");
  const [threshold, setThreshold] = useState(0.12);
  const [processing, setProcessing] = useState(false);

  const canvasRef = useRef(null);
  const overlayRef = useRef(null);

  const interpretation = useMemo(() => {
    if (!result) return null;

    if (result.rednessScore >= threshold + 0.08) {
      return {
        label: "High redness detected",
        risk: "Higher coccidiosis concern",
        note: "This sample shows substantial red-dominant pixels. This is only a screening result, not a diagnosis.",
      };
    }

    if (result.rednessScore >= threshold) {
      return {
        label: "Moderate redness detected",
        risk: "Possible coccidiosis concern",
        note: "This sample has moderate red enrichment. Consider flock history, age, and clinical signs.",
      };
    }

    return {
      label: "Low redness detected",
      risk: "Lower coccidiosis concern",
      note: "This image shows limited red-dominant fecal area by this simple color-based screen.",
    };
  }, [result, threshold]);

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPreviewName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result);
      setResult(null);
    };
    reader.readAsDataURL(file);
  }

  useEffect(() => {
    if (!imageSrc) return;

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const maxWidth = 900;
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      drawOverlay(null);
    };

    img.src = imageSrc;
  }, [imageSrc]);

  function drawOverlay(maskData) {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;

    overlay.width = canvas.width;
    overlay.height = canvas.height;

    const octx = overlay.getContext("2d");
    octx.clearRect(0, 0, overlay.width, overlay.height);

    if (!maskData) return;

    const imageData = octx.createImageData(overlay.width, overlay.height);

    for (let i = 0; i < maskData.length; i++) {
      const idx = i * 4;
      if (maskData[i]) {
        imageData.data[idx] = 255;
        imageData.data[idx + 1] = 0;
        imageData.data[idx + 2] = 0;
        imageData.data[idx + 3] = 90;
      }
    }

    octx.putImageData(imageData, 0, 0);
  }

  function analyzeImage() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const mask = new Uint8Array(width * height);

    setProcessing(true);

    let redPixels = 0;
    let tissuePixels = 0;
    let totalRedIntensity = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        const brightness = (r + g + b) / 3;
        const redExcess = r - (g + b) / 2;
        const saturation = Math.max(r, g, b) - Math.min(r, g, b);

        const likelySample = brightness > 25 && brightness < 245 && saturation > 12;
        if (likelySample) tissuePixels++;

        const isRed =
          likelySample &&
          r > 70 &&
          redExcess > 22 &&
          r > g * 1.08 &&
          r > b * 1.08;

        if (isRed) {
          redPixels++;
          totalRedIntensity += redExcess;
          mask[y * width + x] = 1;
        }
      }
    }

    const rednessScore = tissuePixels > 0 ? redPixels / tissuePixels : 0;
    const meanRedIntensity = redPixels > 0 ? totalRedIntensity / redPixels : 0;

    drawOverlay(mask);
    setResult({
      rednessScore,
      redPixels,
      tissuePixels,
      meanRedIntensity,
    });

    setProcessing(false);
  }

  function resetAll() {
    setImageSrc(null);
    setPreviewName("");
    setResult(null);

    const canvas = canvasRef.current;
    const overlay = overlayRef.current;

    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    if (overlay) {
      const octx = overlay.getContext("2d");
      octx.clearRect(0, 0, overlay.width, overlay.height);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: "520px", margin: "0 auto", background: "white", borderRadius: "20px", padding: "20px", boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }}>
        <h1>Chicken Fecal Redness Detector</h1>
        <p style={{ color: "#475569" }}>
          Upload a chicken fecal sample image and screen for redness as a rough indicator of possible coccidiosis.
        </p>

        <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} />

        {previewName && <p style={{ fontSize: "12px", color: "#64748b" }}>Loaded: {previewName}</p>}

        <div style={{ marginTop: "16px" }}>
          <label>Alert threshold: {threshold.toFixed(2)}</label>
          <input
            type="range"
            min="0.03"
            max="0.35"
            step="0.01"
            value={threshold}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ marginTop: "16px", position: "relative", minHeight: "260px", border: "1px solid #cbd5e1", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#fff" }}>
          {!imageSrc && <div style={{ color: "#94a3b8" }}>Your uploaded image will appear here.</div>}
          <canvas ref={canvasRef} style={{ maxWidth: "100%", height: "auto" }} />
          <canvas ref={overlayRef} style={{ position: "absolute", inset: 0, maxWidth: "100%", height: "auto", pointerEvents: "none" }} />
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
          <button onClick={analyzeImage} disabled={!imageSrc || processing} style={{ padding: "12px 16px" }}>
            {processing ? "Analyzing..." : "Analyze"}
          </button>
          <button onClick={resetAll} style={{ padding: "12px 16px" }}>
            Reset
          </button>
        </div>

        {result && interpretation && (
          <div style={{ marginTop: "20px" }}>
            <h3>{interpretation.label}</h3>
            <p><strong>{interpretation.risk}</strong></p>
            <p>{interpretation.note}</p>
            <p>Redness score: {result.rednessScore.toFixed(3)}</p>
            <p>Red pixels: {result.redPixels}</p>
            <p>Sample pixels: {result.tissuePixels}</p>
            <p>Mean red intensity: {result.meanRedIntensity.toFixed(1)}</p>
            <p style={{ color: "#92400e", background: "#fef3c7", padding: "10px", borderRadius: "10px" }}>
              This is a simple screening tool, not a veterinary diagnosis.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}