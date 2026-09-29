# AgroSense

AI-powered smart farming assistant for plant disease detection, offline Edge AI, and precision agriculture.

## Overview

AgroSense combines computer vision, on-device AI, and IoT hardware to help detect crop diseases and provide actionable agricultural guidance.

## Core Technologies

- MobileNetV3 — Edge plant disease classification
- Gemini2B- On-device agricultural advisory for now its use gemini
- MediaPipe Tasks GenAI — Local LLM inference
- ONNX Runtime — Edge model execution
- ESP8266 — IoT gateway
- Soil-moisture sensing
- Pump and solenoid-valve control
- React and TypeScript
- Capacitor Android

## AI Architecture

```text
Camera / Image
      |
      v
gemini vision 
      |
      v
Disease Classification
      |
      v
Gemini ai
      |
      v
On-device Agricultural Advisory
      |
      v
Decision / IoT Layer
      |
      v
ESP8266
      |
      v
Pump / Valve
