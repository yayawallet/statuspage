commit=true

KEYSARRAY=()
COMMAND_ARGS=()

servicesConfig="./services.cfg"
echo "Reading $servicesConfig"
while read -r line
do
  echo "  $line"
  IFS='=' read -ra TOKENS <<< "$line"
  KEYSARRAY+=("${TOKENS[0]}")
  COMMAND_ARGS+=("$(eval echo "${TOKENS[2]}")")
done < "$servicesConfig"

echo "***********************"
echo "Starting health checks with ${#KEYSARRAY[@]} configs:"

mkdir -p logs

for (( index=0; index < ${#KEYSARRAY[@]}; index++))
do
  key="${KEYSARRAY[index]}"
  args="$(echo ${COMMAND_ARGS[index]})"

  echo "  $key=$args"

  for i in 1 2 3 4;
  do
    cmd="curl --write-out '%{http_code}' --silent --output /dev/null $args"
    response=$(eval "$cmd" | tee)
    if [ "$response" -eq 200 ] || [ "$response" -eq 202 ] || [ "$response" -eq 301 ] || [ "$response" -eq 307 ]; then
      result="success"
    else
      result="failed"
    fi
    if [ "$result" = "success" ]; then
      break
    fi
    sleep 5
  done
  tz="Africa/Addis_Ababa"
  dateTime=$(TZ=$tz date +'%Y-%m-%d %H:%M')
  if [[ $commit == true ]]
  then
    echo $dateTime, $result >> "logs/${key}_report.log"
    # By default we keep 10000 last log entries.  Feel free to modify this to meet your needs.
    echo "$(tail -10000 logs/${key}_report.log)" > "logs/${key}_report.log"
  else
    echo "    $dateTime, $result"
  fi
done

if [[ $commit == true ]]
then
  git config --global user.name 'Anteneh Gebeyaw'
  git config --global user.email 'a.gebeyaw@yayawallet.com'
  git add -A --force logs/
  git commit -am '[Automated] Update Health Check Logs'
  git push
fi
