#!/bin/bash
# 台灣即時天氣預報 APK 建置：aapt2 + javac + d8 + uber-apk-signer
set -e
SDK=/home/claude/sdk
AAPT=$SDK/node_modules/aaptjs3/bin/x64/linux/aapt2
JAR=$SDK/android-35.jar
D8="java -cp $SDK/jadx/lib/jadx-1.5.1-all.jar com.android.tools.r8.D8"
VER=${VER:-1.0.0}; CODE=${CODE:-1}
cd "$(dirname "$0")"
VER=$VER CODE=$CODE python3 ../build.py >/dev/null
rm -rf build && mkdir -p build/gen build/cls assets
cp "../dist/台灣即時天氣預報.html" assets/index.html
printf 'package com.ian.dadiweather;\n\npublic class BuildInfo {\n    public static final String VERSION = "%s";\n    public static final int CODE = %s;\n}\n' "$VER" "$CODE" > src/com/ian/dadiweather/BuildInfo.java
$AAPT compile --dir res -o build/res.zip
$AAPT link -o build/base.apk -I $JAR --manifest AndroidManifest.xml --min-sdk-version 26 --target-sdk-version 34 \
  --version-code $CODE --version-name $VER -A assets --java build/gen build/res.zip
javac -nowarn --release 11 -encoding UTF-8 -cp $JAR -d build/cls $(find src build/gen -name '*.java') 2>&1 | grep -v "JAVA_TOOL\|warning" || true
$D8 --release --min-api 26 --lib $JAR --output build $(find build/cls -name '*.class') 2>&1 | grep -v JAVA_TOOL || true
(cd build && zip -q base.apk classes.dex)
java -jar $SDK/uber.jar --apks build/base.apk --ks release.p12 --ksAlias dadi --ksPass dadiweather --ksKeyPass dadiweather -o build/out 2>&1 | grep -E "error|ERROR|Success|VERIFY" | grep -v JAVA_TOOL || true
cp build/out/*-aligned-signed.apk "../dist/台灣即時天氣預報_v$VER.apk"
ls -la ../dist
