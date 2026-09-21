# AgroSense

AI-powered smart farming assistant for plant disease detection, offline Edge AI, and precision agriculture.

## Overview

AgroSense combines computer vision, on-device AI, and IoT hardware to help detect crop diseases and provide actionable agricultural guidance.

## Core Technologies

- MobileNetV3 — Edge plant disease classification
- Gemma 2B-IT — On-device agricultural advisory
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
MobileNetV3 Edge Vision
      |
      v
Disease Classification
      |
      v
Gemma 2B-IT
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
