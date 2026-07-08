#!/bin/bash
cd "/Users/1st/SynologyDrive/Sudyod Carrental"

# ลบ lock files
rm -f .git/HEAD.lock .git/index.lock .git/refs/heads/master.lock

# เปลี่ยนชื่อ branch เป็น main
git branch -m master main 2>/dev/null || true

# เชื่อม remote (ถ้ายังไม่มี)
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/FirstSakkarin/sudyod-carrental.git

# Push
git -c user.email="sakkarin.wisittawong@gmail.com" -c user.name="1St" push -u origin main

echo ""
echo "✅ Push สำเร็จ! เปิด GitHub Pages ได้เลย"
echo "   Settings → Pages → Branch: main / (root) → Save"
echo ""
read -p "กด Enter เพื่อปิด..."
