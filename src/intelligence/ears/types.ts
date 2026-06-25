export interface AudioMetadata {

  duration?: number;

  sampleRate?: number;

  bitrate?: number;

  codec?: string;
}

export interface TempoAnalysis {

  tempo?: number | null;

  timeSignature?: string | null;
}

export interface HarmonicAnalysis {

  key?: string | null;

  scale?: string | null;
}

export interface LoudnessAnalysis {

  integratedLUFS?: number | null;

  shortTermLUFS?: number | null;

  momentaryLUFS?: number | null;

  loudnessRange?: number | null;
}

export interface PeakAnalysis {

  truePeak?: number | null;

  samplePeak?: number | null;

  averagePeak?: number | null;
}

export interface DynamicAnalysis {

  rms?: number | null;

  crestFactor?: number | null;

  dynamicRange?: number | null;
}

export interface StereoAnalysis {

  correlation?: number | null;

  stereoWidth?: number | null;
}

export interface FrequencyAnalysis {

  sub?: number | null;

  bass?: number | null;

  lowMid?: number | null;

  mid?: number | null;

  highMid?: number | null;

  air?: number | null;
}

export interface AudioAnalysis
  extends
    AudioMetadata,
    TempoAnalysis,
    HarmonicAnalysis,
    LoudnessAnalysis,
    PeakAnalysis,
    DynamicAnalysis,
    StereoAnalysis,
    FrequencyAnalysis {}