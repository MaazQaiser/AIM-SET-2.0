"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { Button, type ButtonProps } from "@dc-copilot/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

type SpeechRecognitionAlternativeLike = {
  transcript?: string;
};

type SpeechRecognitionResultLike = {
  isFinal?: boolean;
  0?: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionResultListLike = {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
};

type SpeechRecognitionResultEventLike = Event & {
  resultIndex?: number;
  results?: SpeechRecognitionResultListLike;
};

type SpeechRecognitionErrorEventLike = Event & {
  error?: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: SpeechRecognitionConstructorLike;
  webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
};

interface MicrophoneDictationButtonProps {
  disabled?: boolean;
  onTranscript: (text: string) => void;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructorLike | undefined {
  if (typeof window === "undefined") return undefined;
  const speechWindow = window as WindowWithSpeechRecognition;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function cleanTranscript(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function microphoneErrorLabel(error?: string): string {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "Microphone permission was blocked";
  }
  if (error === "no-speech") {
    return "No speech detected";
  }
  if (error === "audio-capture") {
    return "No microphone was found";
  }
  return "Microphone input is unavailable";
}

export function MicrophoneDictationButton({
  disabled = false,
  onTranscript,
  className,
  variant = "outline",
  size = "icon",
}: MicrophoneDictationButtonProps) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsSupported(Boolean(getSpeechRecognitionCtor()));
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (disabled) return;
    const Recognition = getSpeechRecognitionCtor();
    if (!Recognition) {
      setError("Voice input is not supported in this browser");
      return;
    }

    recognitionRef.current?.abort();
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event) => {
      const results = event.results;
      if (!results) return;
      let transcript = "";
      const startIndex = event.resultIndex ?? 0;
      for (let index = startIndex; index < results.length; index += 1) {
        transcript += ` ${results[index]?.[0]?.transcript ?? ""}`;
      }
      const cleaned = cleanTranscript(transcript);
      if (cleaned) onTranscript(cleaned);
    };
    recognition.onerror = (event) => {
      setError(microphoneErrorLabel(event.error));
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setError(null);
    setIsListening(true);
    try {
      recognition.start();
    } catch {
      setIsListening(false);
      recognitionRef.current = null;
      setError("Microphone input could not start");
    }
  }, [disabled, onTranscript]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
      return;
    }
    startListening();
  }, [isListening, startListening, stopListening]);

  const unavailable = !isSupported || disabled;
  const label = isListening
    ? "Stop microphone dictation"
    : isSupported
      ? "Use microphone"
      : "Voice input is not supported in this browser";
  const tooltip = error ?? (isListening ? "Listening..." : label);
  const Icon = isListening ? MicOff : Mic;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={cn(
            "shrink-0",
            isListening && "border-red-300 bg-red-50 text-red-600 hover:bg-red-50",
            className
          )}
          aria-label={label}
          aria-pressed={isListening}
          disabled={unavailable && !isListening}
          onClick={toggleListening}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
