const maxDays = 30;

async function genReportLog(container, key, label) {
    const response = await fetch("logs/" + key + "_report.log");
    let statusLines = "";
    if (response.ok) {
        statusLines = await response.text();
    }

    const normalized = normalizeData(statusLines);
    const statusStream = constructStatusStream(key, label, normalized);

    statusStream.id = key;

    const existing = document.getElementById(key);
    if (existing) {
        existing.innerHTML = statusStream.innerHTML;
    } else {
        container.appendChild(statusStream);
    }
}

function constructStatusStream(key, label, uptimeData) {
    let streamContainer = templatize("statusStreamContainerTemplate");
    for (var ii = maxDays - 1; ii >= 0; ii--) {
        let line = constructStatusLine(key, ii, uptimeData[ii]);
        streamContainer.appendChild(line);
    }

    const lastSet = uptimeData[0];
    const color = getColor(lastSet);

    const container = templatize("statusContainerTemplate", {
        title: key,
        label: label,
        color: color,
        status: getStatusText(color),
        upTime: uptimeData.upTime,
    });

    console.log(container.childNodes);

    container.childNodes[1].appendChild(streamContainer);
    return container;
}

function constructStatusLine(key, relDay, upTimeArray) {
    let date = new Date(new Date().toLocaleString('en', {timeZone: 'Africa/Addis_Ababa'}));

    date.setDate(date.getDate() - relDay);

    return constructStatusSquare(key, date, upTimeArray);
}

function getColor(uptimeVal) {
    return uptimeVal == null
        ? "nodata"
        : uptimeVal == 1
            ? "success"
            : uptimeVal < 0.3
                ? "failure"
                : "partial";
}

function constructStatusSquare(key, date, uptimeVal) {
    const color = getColor(uptimeVal);
    let square = templatize("statusSquareTemplate", {
        color: color,
        tooltip: getTooltip(key, date, color),
    });

    const show = () => {
        showTooltip(square, key, date, color);
    };
    square.addEventListener("mouseover", show);
    square.addEventListener("mousedown", show);
    square.addEventListener("mouseout", hideTooltip);
    return square;
}

let cloneId = 0;

function templatize(templateId, parameters) {
    let clone = document.getElementById(templateId).cloneNode(true);
    clone.id = "template_clone_" + cloneId++;
    if (!parameters) {
        return clone;
    }

    applyTemplateSubstitutions(clone, parameters);
    return clone;
}

function applyTemplateSubstitutions(node, parameters) {
    const attributes = node.getAttributeNames();
    for (var ii = 0; ii < attributes.length; ii++) {
        const attr = attributes[ii];
        const attrVal = node.getAttribute(attr);
        node.setAttribute(attr, templatizeString(attrVal, parameters));
    }

    if (node.childElementCount === 0) {
        node.innerText = templatizeString(node.innerText, parameters);
    } else {
        const children = Array.from(node.children);
        children.forEach((n) => {
            applyTemplateSubstitutions(n, parameters);
        });
    }
}

function templatizeString(text, parameters) {
    if (parameters) {
        for (const [key, val] of Object.entries(parameters)) {
            text = text.replaceAll("$" + key, val);
        }
    }
    return text;
}

function getStatusText(color) {
    return color === "nodata"
        ? "No Data Available"
        : color === "success"
            ? "Fully Operational"
            : color === "failure"
                ? "Major Outage"
                : color === "partial"
                    ? "Partial Outage"
                    : "Unknown";
}

function getStatusDescriptiveText(color) {
    return color === "nodata"
        ? "No Data Available: Health check was not performed"
        : color === "success"
            ? "No downtime recorded"
            : color === "failure"
                ? "Major outages recorded"
                : color === "partial"
                    ? "Partial outages recorded"
                    : "Unknown";
}

function getTooltip(key, date, quartile, color) {
    let statusText = getStatusText(color);
    return `${key} | ${date.toDateString()} : ${quartile} : ${statusText}`;
}

function create(tag, className) {
    let element = document.createElement(tag);
    element.className = className;
    return element;
}

function normalizeData(statusLines) {
    const rows = statusLines.split("\n");
    const dateNormalized = splitRowsByDate(rows);

    let relativeDateMap = {};
    const now = new Date(new Date().toLocaleString('en', {timeZone: 'Africa/Addis_Ababa'}));
    for (const [key, val] of Object.entries(dateNormalized)) {
        if (key === "upTime") {
            continue;
        }

        const relDays = getRelativeDays(now, new Date(key).getTime());
        relativeDateMap[relDays] = getDayAverage(val);
    }

    relativeDateMap.upTime = dateNormalized.upTime;
    return relativeDateMap;
}

function getDayAverage(val) {
    if (!val || val.length === 0) {
        return null;
    } else {
        return val.reduce((a, v) => a + v) / val.length;
    }
}

function getRelativeDays(date1, date2) {
    return Math.floor(Math.abs((date1 - date2) / (24 * 3600 * 1000)));
}

function splitRowsByDate(rows) {
    let dateValues = {};
    let sum = 0,
        count = 0;
    for (var ii = 0; ii < rows.length; ii++) {
        const row = rows[ii];
        if (!row) {
            continue;
        }

        const [dateTimeStr, resultStr] = row.split(",", 2);
        // Replace '-' with '/' because Safari
        const dateTime = new Date(
            Date.parse(dateTimeStr.replaceAll("-", "/") + " GMT")
        );
        const dateStr = dateTime.toDateString();

        let resultArray = dateValues[dateStr];
        if (!resultArray) {
            resultArray = [];
            dateValues[dateStr] = resultArray;
            if (dateValues.length > maxDays) {
                break;
            }
        }

        let result = 0;
        if (resultStr.trim() === "success") {
            result = 1;
        }
        sum += result;
        count++;

        resultArray.push(result);
    }

    const upTime = count ? ((sum / count) * 100).toFixed(2) + "%" : "--%";
    dateValues.upTime = upTime;
    return dateValues;
}

let tooltipTimeout = null;

function showTooltip(element, key, date, color) {
    clearTimeout(tooltipTimeout);
    const toolTipDiv = document.getElementById("tooltip");

    document.getElementById("tooltipDateTime").innerText = date.toDateString();
    document.getElementById("tooltipDescription").innerText =
        getStatusDescriptiveText(color);

    const statusDiv = document.getElementById("tooltipStatus");
    statusDiv.innerText = getStatusText(color);
    statusDiv.className = color;

    toolTipDiv.style.top = element.offsetTop + element.offsetHeight + 10;
    toolTipDiv.style.left =
        element.offsetLeft + element.offsetWidth / 2 - toolTipDiv.offsetWidth / 2;
    toolTipDiv.style.opacity = "1";
}

function hideTooltip() {
    tooltipTimeout = setTimeout(() => {
        const toolTipDiv = document.getElementById("tooltip");
        toolTipDiv.style.opacity = "0";
    }, 1000);
}

async function genAllReports() {
    const response = await fetch("services.cfg");

    const reportContainer = document.getElementById("reports");

    const configText = await response.text();
    const configLines = configText.split("\n");
    for (let ii = 0; ii < configLines.length; ii++) {
        const configLine = configLines[ii];
        const [key, label] = configLine.split("=");
        if (!key || !label) {
            continue;
        }

        await genReportLog(
            reportContainer,
            key,
            label.trim()
        );
    }
}

async function genIncidentReport() {

    const activeIncidentsResponse = await fetch("incident_report_active.md");
    const activeIncidentsText = await activeIncidentsResponse.text();

    const pastIncidentsResponse = await fetch("incident_report_past.md");
    const pastIncidentsText = await pastIncidentsResponse.text();

    try {
        const activeDom = DOMPurify.sanitize(marked.parse(activeIncidentsText.trim().length > 0 ? activeIncidentsText : "No active incidents"));
        const inactiveDom = DOMPurify.sanitize(marked.parse(pastIncidentsText.trim().length > 0 ? pastIncidentsText : "No past incidents"));

        document.getElementById("activeIncidentReports").innerHTML = activeDom;
        document.getElementById("pastIncidentReports").innerHTML = inactiveDom;

        if (activeIncidentsText.trim().length > 0) {
            setTimeout(() => {
                document.getElementById("incidents").scrollIntoView(true);
            }, 1000);
        }
    } catch (e) {
        console.log(e.message);
    }
}
