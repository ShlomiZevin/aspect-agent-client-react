#!/bin/sh
# Ten full passes, each on its own fresh database. Per-run output lands in ./runs/.
# A run that never reaches its stand counts as failed; nothing from an earlier run
# can be read back as this run's result.
HERE="C:/Users/ziben/AppData/Local/Temp/claude/g--Shlomi-freeda2/b42e87f8-aba4-4be4-8f90-20419b1a18d1/scratchpad/pg"
CLIENT=/g/Shlomi/freeda2/aspect-agent-client-react
SERVER=/g/Shlomi/freeda2/aspect-agent-server
OUT="$CLIENT/verification/aspect-management"
cd "$HERE" || exit 1
sh stop-stand.sh
rm -rf runs data data-*; mkdir -p runs

(cd "$CLIENT" && npx vite --port 5173 --strictPort > "$HERE/runs/vite.log" 2>&1) &
for i in $(seq 1 30); do grep -q "Local" runs/vite.log 2>/dev/null && break; sleep 2; done

for run in 1 2 3 4 5 6 7 8 9 10; do
  (cd "$SERVER" && node scripts/test-aspect-management-unit.js) > "runs/unit-$run.log" 2>&1
  unit=$?
  sh stop-stand.sh >> runs/stop.log
  rm -f stand.log "$OUT/results.json" "$OUT/ask-answers.json"
  RUN=$run node stand.js > stand.log 2>&1 &
  ready=no
  for i in $(seq 1 60); do grep -q "STAND READY" stand.log 2>/dev/null && { ready=yes; break; }; sleep 2; done
  start=$(date +%s)
  if [ "$ready" = yes ]; then
    node verify.js > "runs/ui-$run.log" 2>&1
    ui=$?
    cp "$OUT/results.json" "runs/results-$run.json" 2>/dev/null
    cp "$OUT/ask-answers.json" "runs/answers-$run.json" 2>/dev/null
  else
    ui=99
    cp stand.log "runs/stand-failed-$run.log"
    echo "STAND NOT READY" > "runs/ui-$run.log"
  fi
  echo "run $run: unit=$unit stand=$ready ui=$ui $(grep -E 'passed$' "runs/ui-$run.log") $(( $(date +%s) - start ))s" >> runs/summary.txt
done

sh stop-stand.sh >> runs/stop.log
pid=$(netstat -ano | grep -E "[:.]5173 +.*LISTENING" | awk '{print $NF}' | sort -u | head -1)
[ -n "$pid" ] && taskkill //PID "$pid" //F //T > /dev/null 2>&1
echo DONE >> runs/summary.txt
exit 0
