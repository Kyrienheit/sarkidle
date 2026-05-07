@echo off
set /p msg="Commit mesaji girin: "
if "%msg%"=="" set msg="Hizli Guncelleme"
echo GitHub'a yukleniyor...
git add .
git commit -m "%msg%"
git push origin master
echo Islem tamamlandi!
pause
