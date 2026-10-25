npm run build
tar -czf .\xyxy.tar.gz server/src server/res common package.json package-lock.json client/dist debian.sh cert
scp .\xyxy.tar.gz bambloo@119.45.253.135:~/
