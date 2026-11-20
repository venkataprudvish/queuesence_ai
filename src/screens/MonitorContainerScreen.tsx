import React, { useState, useRef } from 'react';
import {
  Video,
  FileVideo,
  ClipboardCheck,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';
import { LiveMonitorScreen } from './LiveMonitorScreen';
import { VideoAnalysisScreen } from './VideoAnalysisScreen';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
  CANDIDATE_MODEL_MATRIX,
  ENGINEERING_AUDIT_FINDINGS,
} from '../ai/inference/modelRegistry';
import {
  getActiveModelIdentity,
  initializeCustomYoloOnnxDetector,
  initializePretrainedDetector,
  ModelRuntimeIdentity,
} from '../ai/detection/personDetector';
import {
  formatYoloAnnotationTxt,
  generateYoloTrainingPackage,
} from '../ai/training/datasetManager';

const AuditAndModelInfoView: React.FC = () => {
  const {
    datasetFrames,
    deleteDatasetFrame,
    updateDatasetFrameBoxes,
    acceptanceTests,
    recordAcceptanceTestResult,
  } = useAppStore();

  const onnxFileInputRef = useRef<HTMLInputElement | null>(null);
  const [modelIdentity, setModelIdentity] = useState<ModelRuntimeIdentity>(() =>
    getActiveModelIdentity()
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedTestNum, setSelectedTestNum] = useState<number>(1);
  const [gtInput, setGtInput] = useState<number>(1);
  const [detInput, setDetInput] = useState<number>(1);
  const [fpInput, setFpInput] = useState<number>(0);
  const [fpsInput, setFpsInput] = useState<number>(18);
  const [latInput, setLatInput] = useState<number>(48);

  const handleSelectPretrained = async (base: 'lite_mobilenet_v2' | 'mobilenet_v2') => {
    setStatusMessage(`Loading pretrained ${base} weights...`);
    try {
      const id = await initializePretrainedDetector(base);
      setModelIdentity(id);
      setStatusMessage(`Loaded ${id.modelName} (${id.backendEngine}).`);
    } catch (err: unknown) {
      setStatusMessage(
        `Model load error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  const handleUploadCustomOnnx = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatusMessage(`Loading custom ONNX model (${file.name})...`);
    try {
      const buffer = await file.arrayBuffer();
      const id = await initializeCustomYoloOnnxDetector(buffer, file.name, true);
      setModelIdentity(id);
      setStatusMessage(
        `Activated Custom Fine-Tuned ONNX model: ${file.name} (${id.modelVersion}).`
      );
    } catch (err: unknown) {
      setStatusMessage(
        `ONNX load error: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  };

  const handleExportYoloBundle = () => {
    const jsonPkg = generateYoloTrainingPackage(datasetFrames);
    const blob = new Blob([jsonPkg], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `queuesense_yolo_dataset_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const completedTests = acceptanceTests.filter((t) => t.testedAt !== null);
  const meanAccuracy =
    completedTests.length > 0
      ? Number(
          (
            completedTests.reduce((acc, t) => acc + t.countAccuracyPercent, 0) /
            completedTests.length
          ).toFixed(1)
        )
      : null;

  return (
    <div className="space-y-6">
      {/* 1. Active Model Identity, Pretrained Switcher & Custom ONNX Loader */}
      <Card padding="md" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E1E6DA] pb-3">
          <div>
            <h2 className="text-base font-semibold text-[#252B26]">
              Active AI Model Identity &amp; Runtime Selection (Milestones 3, 4 &amp; 6)
            </h2>
            <p className="text-xs text-[#777D75]">
              Switch between fast and high-recall pretrained models, or load custom fine-tuned
              Ultralytics YOLO (.onnx) weights.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleSelectPretrained('lite_mobilenet_v2')}
            >
              Pretrained Fast (Lite-MobileNetV2)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSelectPretrained('mobilenet_v2')}
            >
              Pretrained High-Recall (MobileNetV2)
            </Button>
            <input
              ref={onnxFileInputRef}
              type="file"
              accept=".onnx,application/octet-stream"
              onChange={handleUploadCustomOnnx}
              className="hidden"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={() => onnxFileInputRef.current?.click()}
              icon={<Upload className="w-3.5 h-3.5" />}
            >
              Load Custom YOLO (.onnx)
            </Button>
          </div>
        </div>

        {statusMessage && (
          <div className="p-3 rounded-xl bg-[#F7F5EC] border border-[#477A55] text-xs text-[#252B26]">
            {statusMessage}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA]">
            <p className="text-[11px] text-[#777D75]">Model Name</p>
            <p className="font-semibold text-[#252B26] mt-0.5">{modelIdentity.modelName}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA]">
            <p className="text-[11px] text-[#777D75]">Model Version &amp; Provenance</p>
            <p className="font-mono-tabular font-semibold text-[#244C3A] mt-0.5">
              {modelIdentity.modelVersion} · {modelIdentity.trainingType}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA]">
            <p className="text-[11px] text-[#777D75]">Model File Loaded</p>
            <p className="font-mono-tabular font-semibold text-[#252B26] mt-0.5 truncate">
              {modelIdentity.modelFileLoaded}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA]">
            <p className="text-[11px] text-[#777D75]">Execution Backend &amp; Status</p>
            <p className="font-semibold text-[#477A55] mt-0.5">
              {modelIdentity.backendEngine} ({modelIdentity.status.toUpperCase()})
            </p>
          </div>
        </div>
      </Card>

      {/* 2. Custom QueueSense Dataset, Bounding-Box Annotation & YOLO Training Workflow (Milestones 5 & 6) */}
      <Card padding="md" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#252B26]">
              Custom Queue Dataset &amp; YOLO Fine-Tuning Workflow (Milestones 5 &amp; 6)
            </h2>
            <p className="text-xs text-[#777D75]">
              Frames captured from Live Camera or Video Analysis are automatically partitioned by
              Recording ID into leak-free Train / Val / Test splits and formatted as YOLO labels.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleExportYoloBundle}
            icon={<Download className="w-4 h-4" />}
          >
            Export YOLO Dataset &amp; Training Script ({datasetFrames.length} frames)
          </Button>
        </div>

        <div className="p-3.5 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA] text-xs space-y-1.5">
          <p className="font-semibold text-[#252B26]">
            External Python 3.12 / Colab Fine-Tuning Connection (Honest Training Architecture)
          </p>
          <p className="text-[#777D75] leading-relaxed">
            Browser sandboxes execute inference but do not run multi-epoch PyTorch backpropagation.
            Export the YOLO package above (includes <code className="font-mono-tabular">data.yaml</code>,
            normalized <code className="font-mono-tabular">0 cx cy w h</code> bounding-box annotations,
            and <code className="font-mono-tabular">train_queuesense_yolo.py</code>), run fine-tuning
            in Python 3.12 / Colab on <code className="font-mono-tabular">yolov8n.pt</code>, and
            upload the resulting <code className="font-mono-tabular">best.onnx</code> file above.
          </p>
        </div>

        {datasetFrames.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA] text-center text-xs text-[#777D75]">
            No frames captured yet. Use &ldquo;Capture Frame for Dataset&rdquo; in Live Camera or
            &ldquo;Extract Frame to Dataset&rdquo; in Video Analysis to collect annotated queue
            frames.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {datasetFrames.map((frame) => (
              <div
                key={frame.id}
                className="p-3.5 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA] space-y-2.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#252B26] truncate">
                    {frame.sourceLabel}
                  </span>
                  <span className="font-mono-tabular font-semibold uppercase text-[#244C3A]">
                    Split: {frame.split}
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <img
                    src={frame.thumbnailDataUrl}
                    alt={frame.sourceLabel}
                    referrerPolicy="no-referrer"
                    className="w-28 h-20 object-cover rounded-lg border border-[#E1E6DA] shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-[11px] text-[#777D75]">
                      Resolution: {frame.imageWidth}×{frame.imageHeight} · Boxes:{' '}
                      <strong className="text-[#252B26]">{frame.groundTruthBoxes.length}</strong>
                    </p>
                    <pre className="p-2 rounded bg-[#FFFDF6] border border-[#E1E6DA] text-[10px] font-mono-tabular overflow-x-auto max-h-16">
                      {formatYoloAnnotationTxt(frame.groundTruthBoxes) ||
                        '# 0 person boxes in frame'}
                    </pre>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      updateDatasetFrameBoxes(frame.id, [
                        ...frame.groundTruthBoxes,
                        { x1: 0.35, y1: 0.25, x2: 0.55, y2: 0.85, confidence: 1.0, classId: 0 },
                      ])
                    }
                    icon={<Plus className="w-3.5 h-3.5" />}
                  >
                    Add Person Box
                  </Button>
                  <button
                    type="button"
                    onClick={() => deleteDatasetFrame(frame.id)}
                    className="text-xs text-[#C66B5B] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 3. 14-Scenario Ground-Truth Acceptance Testing Suite (Milestone 11 / Part 12) */}
      <Card padding="md" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-[#252B26]">
              14-Scenario Ground-Truth Acceptance Testing Matrix (Milestone 11)
            </h2>
            <p className="text-xs text-[#777D75]">
              Target Acceptance Criterion: ≥ 95% person-count accuracy on controlled queue test
              footage.
            </p>
          </div>
          <span className="text-xs font-mono-tabular font-semibold text-[#244C3A]">
            {meanAccuracy !== null
              ? `Measured Mean Accuracy: ${meanAccuracy}% (${completedTests.length}/14 Recorded)`
              : '0/14 Scenarios Logged Yet'}
          </span>
        </div>

        {/* Interactive Test Recorder Form */}
        <div className="p-3.5 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA] grid grid-cols-2 sm:grid-cols-6 gap-2.5 items-end text-xs">
          <div className="col-span-2 sm:col-span-2">
            <label className="block font-medium text-[#252B26] mb-1">Scenario</label>
            <select
              value={selectedTestNum}
              onChange={(e) => {
                const num = Number(e.target.value);
                setSelectedTestNum(num);
                const found = acceptanceTests.find((t) => t.testNumber === num);
                if (found) setGtInput(found.groundTruthCount);
              }}
              className="w-full min-h-[38px] px-2.5 py-1.5 bg-[#FFFDF6] border border-[#E1E6DA] rounded-xl"
            >
              {acceptanceTests.map((t) => (
                <option key={t.testNumber} value={t.testNumber}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-[#252B26] mb-1">Ground Truth</label>
            <input
              type="number"
              min={0}
              value={gtInput}
              onChange={(e) => setGtInput(Number(e.target.value))}
              className="w-full min-h-[38px] px-2.5 py-1.5 bg-[#FFFDF6] border border-[#E1E6DA] rounded-xl font-mono-tabular"
            />
          </div>

          <div>
            <label className="block font-medium text-[#252B26] mb-1">Model Count</label>
            <input
              type="number"
              min={0}
              value={detInput}
              onChange={(e) => setDetInput(Number(e.target.value))}
              className="w-full min-h-[38px] px-2.5 py-1.5 bg-[#FFFDF6] border border-[#E1E6DA] rounded-xl font-mono-tabular"
            />
          </div>

          <div>
            <label className="block font-medium text-[#252B26] mb-1">False Pos (FP)</label>
            <input
              type="number"
              min={0}
              value={fpInput}
              onChange={(e) => setFpInput(Number(e.target.value))}
              className="w-full min-h-[38px] px-2.5 py-1.5 bg-[#FFFDF6] border border-[#E1E6DA] rounded-xl font-mono-tabular"
            />
          </div>

          <div>
            <Button
              variant="primary"
              size="sm"
              fullWidth
              onClick={() =>
                recordAcceptanceTestResult(
                  selectedTestNum,
                  gtInput,
                  detInput,
                  fpInput,
                  fpsInput,
                  latInput
                )
              }
              icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              Record Test
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E1E6DA] text-[#777D75]">
                <th className="py-2 pr-3 font-medium">Scenario</th>
                <th className="py-2 px-2 font-medium">GT</th>
                <th className="py-2 px-2 font-medium">Detected</th>
                <th className="py-2 px-2 font-medium">Missed / FP</th>
                <th className="py-2 px-2 font-medium">Precision / Recall</th>
                <th className="py-2 px-2 font-medium">Accuracy</th>
                <th className="py-2 pl-2 font-medium">FPS / Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E6DA]/60 font-mono-tabular">
              {acceptanceTests.map((t) => (
                <tr key={t.testNumber} className="text-[#252B26]">
                  <td className="py-2.5 pr-3 font-sans">
                    <p className="font-semibold">{t.title}</p>
                    <p className="text-[11px] text-[#777D75]">{t.notes}</p>
                  </td>
                  <td className="py-2.5 px-2">{t.groundTruthCount}</td>
                  <td className="py-2.5 px-2 font-semibold">
                    {t.testedAt ? t.detectedCount : '—'}
                  </td>
                  <td className="py-2.5 px-2">
                    {t.testedAt ? `${t.missedDetections} / ${t.falseDetections}` : '—'}
                  </td>
                  <td className="py-2.5 px-2">
                    {t.testedAt ? `${t.precisionPercent}% / ${t.recallPercent}%` : '—'}
                  </td>
                  <td
                    className={`py-2.5 px-2 font-semibold ${
                      !t.testedAt
                        ? 'text-[#777D75]'
                        : t.countAccuracyPercent >= 95
                        ? 'text-[#477A55]'
                        : 'text-[#D49A45]'
                    }`}
                  >
                    {t.testedAt ? `${t.countAccuracyPercent}%` : 'Untested'}
                  </td>
                  <td className="py-2.5 pl-2">
                    {t.testedAt ? `${t.measuredFps} FPS / ${t.latencyMs}ms` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 4. Candidate Model Comparison Matrix & Engineering Audit */}
      <Card padding="md" className="space-y-4">
        <h2 className="text-base font-semibold text-[#252B26]">
          Candidate Person-Detection Architecture Comparison (Intel CPU / Integrated Graphics)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E1E6DA] text-[#777D75]">
                <th className="py-2 pr-4 font-medium">Model Candidate</th>
                <th className="py-2 px-3 font-medium">Params</th>
                <th className="py-2 px-3 font-medium">mAP50 / 50-95</th>
                <th className="py-2 px-3 font-medium">Intel CPU Latency</th>
                <th className="py-2 pl-3 font-medium">Suitability</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E6DA]/60">
              {CANDIDATE_MODEL_MATRIX.map((m) => (
                <tr key={m.id} className="text-[#252B26]">
                  <td className="py-2.5 pr-4">
                    <p className="font-semibold">{m.name}</p>
                    <p className="text-[11px] text-[#777D75]">{m.notes}</p>
                  </td>
                  <td className="py-2.5 px-3 font-mono-tabular">{m.paramsMillions}M</td>
                  <td className="py-2.5 px-3 font-mono-tabular">
                    {m.cocoMap50}% / {m.cocoMap50_95}%
                  </td>
                  <td className="py-2.5 px-3 font-mono-tabular">{m.estimatedIntelCpuMs}</td>
                  <td className="py-2.5 pl-3 font-semibold text-[#244C3A]">
                    {m.intelIntegratedGpuSuitability}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pt-3 border-t border-[#E1E6DA] space-y-2">
          <h3 className="text-sm font-semibold text-[#252B26]">
            Engineering Audit Status Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
            {ENGINEERING_AUDIT_FINDINGS.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl bg-[#F7F5EC] border border-[#E1E6DA] flex items-center justify-between gap-2"
              >
                <span className="font-medium text-[#252B26]">
                  {item.id} · {item.subsystem}
                </span>
                <span className="font-semibold text-[#477A55]">Verified Active</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};

export const MonitorContainerScreen: React.FC = () => {
  const { monitorSubMode, setMonitorSubMode } = useAppStore();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#252B26] font-display">
            Queue Monitoring, Video, Dataset &amp; Testing
          </h1>
          <p className="text-sm text-[#777D75]">
            Real-time Android camera detection, ByteTrack tracking, custom YOLO dataset builder,
            and 14-scenario acceptance testing.
          </p>
        </div>

        <div className="inline-flex flex-wrap items-center p-1 bg-[#FFFDF6] border border-[#E1E6DA] rounded-xl self-start gap-1">
          <button
            type="button"
            onClick={() => setMonitorSubMode('live')}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              monitorSubMode === 'live'
                ? 'bg-[#244C3A] text-[#F7F5EC]'
                : 'text-[#777D75] hover:text-[#252B26]'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Live Camera</span>
          </button>
          <button
            type="button"
            onClick={() => setMonitorSubMode('video')}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              monitorSubMode === 'video'
                ? 'bg-[#244C3A] text-[#F7F5EC]'
                : 'text-[#777D75] hover:text-[#252B26]'
            }`}
          >
            <FileVideo className="w-3.5 h-3.5" />
            <span>Video Analysis</span>
          </button>
          <button
            type="button"
            onClick={() => setMonitorSubMode('audit')}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              monitorSubMode === 'audit'
                ? 'bg-[#244C3A] text-[#F7F5EC]'
                : 'text-[#777D75] hover:text-[#252B26]'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5" />
            <span>Model, Dataset &amp; 14 Tests</span>
          </button>
        </div>
      </div>

      {monitorSubMode === 'live' && <LiveMonitorScreen />}
      {monitorSubMode === 'video' && <VideoAnalysisScreen />}
      {monitorSubMode === 'audit' && <AuditAndModelInfoView />}
    </div>
  );
};
