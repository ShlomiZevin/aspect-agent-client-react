#!/bin/sh
# Stops the stand: whatever listens on port 3000, and every postgres.exe whose
# command line runs out of this scratchpad. ExecutablePath reads empty for these
# processes, and an orphaned child keeps the dead parent's listen socket, so all of
# them have to go. Waits until none are left.
pid=$(netstat -ano | grep -E "[:.]3000 +.*LISTENING" | awk '{print $NF}' | sort -u | head -1)
[ -n "$pid" ] && taskkill //PID "$pid" //F //T >/dev/null 2>&1
for i in $(seq 1 20); do
  left=$(powershell.exe -NoProfile -Command "\$p = Get-CimInstance Win32_Process -Filter \"Name='postgres.exe'\" | Where-Object { \$_.CommandLine -like '*scratchpad/pg/node_modules/@embedded-postgres*' }; \$p | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force -ErrorAction SilentlyContinue }; @(\$p).Count" | tr -d '\r')
  [ "$left" = "0" ] && ! netstat -ano | grep -qE "[:.]3000 +.*LISTENING" && exit 0
  sleep 1
done
echo "STAND STILL RUNNING"
exit 1
