// ─── Web Speech API Type Declarations ────────────────────────────────────────
//
// TypeScript's built-in DOM library doesn't fully cover the Web Speech API.
// These declarations tell TypeScript the shape of SpeechRecognition and related
// types so we get proper autocomplete and type checking in page.tsx.
//
// These are browser globals — they exist on window at runtime, but TypeScript
// needs to know about them at compile time via these declaration files (.d.ts).

// SpeechRecognition — the main class for capturing speech from the microphone
// Usage: const rec = new SpeechRecognition(); rec.start();
declare class SpeechRecognition extends EventTarget {
  lang: string;             // BCP 47 language tag, e.g. "en-US"
  interimResults: boolean;  // true = fire results while still speaking; false = only when done
  maxAlternatives: number;  // how many transcription guesses to return (we use 1)
  continuous: boolean;      // true = keep listening after first result; false = stop after one

  // Event handlers — assigned as functions, called by the browser at the right moment
  onstart:  ((this: SpeechRecognition, ev: Event) => void) | null;                      // mic opened
  onend:    ((this: SpeechRecognition, ev: Event) => void) | null;                      // mic closed
  onerror:  ((this: SpeechRecognition, ev: Event) => void) | null;                      // recognition failed
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;     // speech recognized

  start():  void; // begin listening
  stop():   void; // stop listening gracefully (fires onresult if speech was captured)
  abort():  void; // stop immediately without firing onresult
}

// SpeechRecognitionEvent — the event object passed to onresult
// Contains all the transcription results from this recognition session
declare interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList; // array-like list of results
  readonly resultIndex: number;                   // index of the most recent result
}

// SpeechRecognitionResultList — array-like container of all results
// Usually has one result unless continuous mode is on
declare interface SpeechRecognitionResultList {
  readonly length: number;                          // number of results
  item(index: number): SpeechRecognitionResult;    // get result by index (method form)
  [index: number]: SpeechRecognitionResult;        // get result by index (array form)
}

// SpeechRecognitionResult — one "phrase" that was recognized
// Contains one or more alternative transcriptions (we use index [0])
declare interface SpeechRecognitionResult {
  readonly length: number;                                // number of alternatives
  readonly isFinal: boolean;                             // true = final result, false = interim
  item(index: number): SpeechRecognitionAlternative;    // get alternative by index
  [index: number]: SpeechRecognitionAlternative;        // array-style access
}

// SpeechRecognitionAlternative — one transcription guess
// transcript = the text; confidence = how sure the browser is (0.0 to 1.0)
declare interface SpeechRecognitionAlternative {
  readonly transcript: string;  // the recognized text, e.g. "hello Mira"
  readonly confidence: number;  // 0.0 = not sure, 1.0 = very confident
}

// Declare SpeechRecognition as a constructable global class
// This lets us write: new SpeechRecognition() without TypeScript complaining
declare var SpeechRecognition: {
  prototype: SpeechRecognition; // instance type
  new (): SpeechRecognition;    // constructor signature
};
