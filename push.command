#!/bin/bash
cd "/Users/1st/SynologyDrive/Sudyod Carrental"

echo "📦 กำลัง commit และ push..."

# ลบ lock files
rm -f .git/HEAD.lock .git/index.lock .git/refs/heads/master.lock 2>/dev/null

# Stage ทุกไฟล์
git add -A

# Commit (ถ้ามีการเปลี่ยนแปลง)
git -c user.email="sakkarin.wisittawong@gmail.com" -c user.name="1St" \
  commit -m "Update: $(date '+%Y-%m-%d %H:%M')" 2>/dev/null || echo "ℹ️  ไม่มีไฟล์ใหม่ที่ต้อง commit"

# เชื่อม remote
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/FirstSakkarin/sudyod-carrental.git

# Push
git -c user.email="sakkarin.wisittawong@gmail.com" -c user.name="1St" push -u origin main

echo ""
echo "✅ Push สำเร็จ! รอประมาณ 1-2 นาที แล้วเปิด:"
echo "   https://firstsakkarin.github.io/sudyod-carrental/"
echo ""
read -p "กด Enter เพื่อปิด..."
