/**
 * Voice Dictation Service
 * Provides centralized voice dictation functionality with medical vocabulary optimization
 */

interface VoiceDictationConfig {
  language: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
}

interface MedicalVocabulary {
  term: string;
  alternatives: string[];
  priority: number;
}

class VoiceDictationService {
  private config: VoiceDictationConfig;
  private medicalVocabulary: MedicalVocabulary[];
  private userPreferences: Map<string, any>;

  constructor() {
    this.config = {
      language: 'en-US',
      continuous: true,
      interimResults: true,
      maxAlternatives: 3
    };

    this.medicalVocabulary = this.loadMedicalVocabulary();
    this.userPreferences = new Map();
    this.loadUserPreferences();
  }

  /**
   * Check if speech recognition is supported
   */
  isSupported(): boolean {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  /**
   * Get available languages
   */
  getAvailableLanguages(): string[] {
    return [
      'en-US', // English (US)
      'en-GB', // English (UK)
      'es-ES', // Spanish
      'fr-FR', // French
      'de-DE', // German
      'it-IT', // Italian
      'pt-BR', // Portuguese (Brazil)
      'zh-CN', // Chinese (Simplified)
      'ja-JP', // Japanese
      'ko-KR'  // Korean
    ];
  }

  /**
   * Set language for dictation
   */
  setLanguage(language: string): void {
    if (this.getAvailableLanguages().includes(language)) {
      this.config.language = language;
      this.saveUserPreferences();
    }
  }

  /**
   * Get current language
   */
  getLanguage(): string {
    return this.config.language;
  }

  /**
   * Get configuration
   */
  getConfig(): VoiceDictationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<VoiceDictationConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveUserPreferences();
  }

  /**
   * Process transcript with medical vocabulary optimization
   */
  processTranscript(rawTranscript: string): string {
    let processed = rawTranscript;

    // Apply medical vocabulary corrections
    processed = this.applyMedicalVocabulary(processed);

    // Apply punctuation commands
    processed = this.processPunctuationCommands(processed);

    // Apply capitalization rules
    processed = this.applyCapitalization(processed);

    // Clean up spacing
    processed = this.cleanupSpacing(processed);

    return processed;
  }

  /**
   * Apply medical vocabulary corrections
   */
  private applyMedicalVocabulary(text: string): string {
    let corrected = text;

    // Sort by priority (higher priority first)
    const sortedVocab = [...this.medicalVocabulary].sort((a, b) => b.priority - a.priority);

    for (const vocab of sortedVocab) {
      // Check if any alternative matches
      for (const alt of vocab.alternatives) {
        const regex = new RegExp(`\\b${alt}\\b`, 'gi');
        if (regex.test(corrected)) {
          corrected = corrected.replace(regex, vocab.term);
        }
      }
    }

    return corrected;
  }

  /**
   * Process punctuation commands
   */
  private processPunctuationCommands(text: string): string {
    const commands: Record<string, string> = {
      'period': '.',
      'comma': ',',
      'question mark': '?',
      'exclamation point': '!',
      'exclamation mark': '!',
      'colon': ':',
      'semicolon': ';',
      'new line': '\n',
      'new paragraph': '\n\n',
      'open parenthesis': '(',
      'close parenthesis': ')',
      'open bracket': '[',
      'close bracket': ']',
      'dash': '-',
      'hyphen': '-',
      'slash': '/',
      'backslash': '\\',
      'at sign': '@',
      'hashtag': '#',
      'dollar sign': '$',
      'percent': '%',
      'ampersand': '&',
      'asterisk': '*',
      'plus': '+',
      'equals': '=',
      'underscore': '_'
    };

    let processed = text;

    Object.entries(commands).forEach(([command, punctuation]) => {
      const regex = new RegExp(`\\s*${command}\\s*`, 'gi');
      processed = processed.replace(regex, punctuation + ' ');
    });

    return processed;
  }

  /**
   * Apply capitalization rules
   */
  private applyCapitalization(text: string): string {
    let capitalized = text;

    // Capitalize first letter
    if (capitalized.length > 0) {
      capitalized = capitalized.charAt(0).toUpperCase() + capitalized.slice(1);
    }

    // Capitalize after sentence-ending punctuation
    capitalized = capitalized.replace(/([.!?]\s+)([a-z])/g, (match, p1, p2) => {
      return p1 + p2.toUpperCase();
    });

    // Capitalize after new lines
    capitalized = capitalized.replace(/(\n)([a-z])/g, (match, p1, p2) => {
      return p1 + p2.toUpperCase();
    });

    return capitalized;
  }

  /**
   * Clean up spacing
   */
  private cleanupSpacing(text: string): string {
    let cleaned = text;

    // Remove multiple spaces
    cleaned = cleaned.replace(/\s+/g, ' ');

    // Fix spacing around punctuation
    cleaned = cleaned.replace(/\s+([.,!?;:])/g, '$1');
    cleaned = cleaned.replace(/([.,!?;:])\s*/g, '$1 ');

    // Fix spacing around parentheses
    cleaned = cleaned.replace(/\(\s+/g, '(');
    cleaned = cleaned.replace(/\s+\)/g, ')');

    // Trim
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * Load medical vocabulary
   */
  private loadMedicalVocabulary(): MedicalVocabulary[] {
    return [
      // Common medical terms that might be misheard
      { term: 'hepatomegaly', alternatives: ['hepato megaly', 'hepato megalee'], priority: 10 },
      { term: 'splenomegaly', alternatives: ['spleno megaly', 'spleno megalee'], priority: 10 },
      { term: 'cardiomegaly', alternatives: ['cardio megaly', 'cardio megalee'], priority: 10 },
      { term: 'pneumonia', alternatives: ['new monia', 'pneumonea'], priority: 10 },
      { term: 'atelectasis', alternatives: ['at elect asis', 'atelectases'], priority: 10 },
      { term: 'effusion', alternatives: ['a fusion', 'effusions'], priority: 10 },
      { term: 'consolidation', alternatives: ['consolidations'], priority: 10 },
      { term: 'nodule', alternatives: ['nodules', 'nod yule'], priority: 10 },
      { term: 'lesion', alternatives: ['lesions', 'lee sion'], priority: 10 },
      { term: 'mass', alternatives: ['masses'], priority: 10 },
      { term: 'edema', alternatives: ['oedema', 'a dema'], priority: 10 },
      { term: 'hemorrhage', alternatives: ['haemorrhage', 'hemmorrhage'], priority: 10 },
      { term: 'infarction', alternatives: ['in farction'], priority: 10 },
      { term: 'ischemia', alternatives: ['is kemia', 'ischaemia'], priority: 10 },
      { term: 'necrosis', alternatives: ['ne crosis'], priority: 10 },
      { term: 'stenosis', alternatives: ['sten osis'], priority: 10 },
      { term: 'thrombosis', alternatives: ['throm bosis'], priority: 10 },
      { term: 'embolism', alternatives: ['embo lism'], priority: 10 },
      { term: 'aneurysm', alternatives: ['an eurysm'], priority: 10 },
      { term: 'fracture', alternatives: ['fractures'], priority: 10 },
      
      // Anatomical terms
      { term: 'right upper lobe', alternatives: ['RUL', 'right upper'], priority: 8 },
      { term: 'right middle lobe', alternatives: ['RML', 'right middle'], priority: 8 },
      { term: 'right lower lobe', alternatives: ['RLL', 'right lower'], priority: 8 },
      { term: 'left upper lobe', alternatives: ['LUL', 'left upper'], priority: 8 },
      { term: 'left lower lobe', alternatives: ['LLL', 'left lower'], priority: 8 },
      { term: 'right upper quadrant', alternatives: ['RUQ', 'right upper'], priority: 8 },
      { term: 'right lower quadrant', alternatives: ['RLQ', 'right lower'], priority: 8 },
      { term: 'left upper quadrant', alternatives: ['LUQ', 'left upper'], priority: 8 },
      { term: 'left lower quadrant', alternatives: ['LLQ', 'left lower'], priority: 8 },
      
      // Measurements
      { term: 'millimeter', alternatives: ['mm', 'millimeters'], priority: 5 },
      { term: 'centimeter', alternatives: ['cm', 'centimeters'], priority: 5 },
      { term: 'Hounsfield unit', alternatives: ['HU', 'hounsfield units'], priority: 5 }
    ];
  }

  /**
   * Load user preferences from localStorage
   */
  private loadUserPreferences(): void {
    try {
      const stored = localStorage.getItem('voiceDictationPreferences');
      if (stored) {
        const prefs = JSON.parse(stored);
        this.userPreferences = new Map(Object.entries(prefs));
        
        // Apply stored language
        if (prefs.language) {
          this.config.language = prefs.language;
        }
      }
    } catch (error) {
      console.error('Failed to load voice dictation preferences:', error);
    }
  }

  /**
   * Save user preferences to localStorage
   */
  private saveUserPreferences(): void {
    try {
      const prefs = {
        language: this.config.language,
        ...Object.fromEntries(this.userPreferences)
      };
      localStorage.setItem('voiceDictationPreferences', JSON.stringify(prefs));
    } catch (error) {
      console.error('Failed to save voice dictation preferences:', error);
    }
  }

  /**
   * Get user preference
   */
  getUserPreference(key: string): any {
    return this.userPreferences.get(key);
  }

  /**
   * Set user preference
   */
  setUserPreference(key: string, value: any): void {
    this.userPreferences.set(key, value);
    this.saveUserPreferences();
  }

  /**
   * Add custom medical term
   */
  addCustomTerm(term: string, alternatives: string[], priority: number = 5): void {
    this.medicalVocabulary.push({ term, alternatives, priority });
    this.saveUserPreferences();
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    vocabularySize: number;
    language: string;
    isSupported: boolean;
  } {
    return {
      vocabularySize: this.medicalVocabulary.length,
      language: this.config.language,
      isSupported: this.isSupported()
    };
  }
}

// Export singleton instance
export const voiceDictationService = new VoiceDictationService();
export default voiceDictationService;
