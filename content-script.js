(async function () {
    const handleMatch = location.pathname.match(/\/profile\/([^\/?#]+)/);
    if (!handleMatch) return;
    const handle = handleMatch[1];

    const $ = window.jQuery;

    function wait(selector) {
        return new Promise(resolve => {
            const el = document.querySelector(selector);
            if (el) return resolve(el);
            const obs = new MutationObserver(() => {
                const el2 = document.querySelector(selector);
                if (el2) {
                    obs.disconnect();
                    resolve(el2);
                }
            });
            obs.observe(document.body, { childList: true, subtree: true });
        });
    }

    const container = await wait("#usersRatingGraphPlaceholder");

    async function fetchHistory() {
        const url = `https://codeforces.com/api/user.rating?handle=${handle}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status !== "OK") throw new Error("CF API failed");
        return data.result;
    }

    const history = await fetchHistory();

    // Build equidistant x values (index based) to mimic CF spacing
    const ratingPoints = [];
    const rankPoints = [];
    history.forEach((h, i) => {
        ratingPoints.push([i, h.newRating]);
        rankPoints.push([i, h.rank]);
    });

    container.innerHTML = "";

    let tooltip = document.getElementById("cf-custom-tooltip");
    if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.style.position = "absolute";
        tooltip.style.background = "rgba(0, 0, 0, 0.8)";
        tooltip.style.color = "#fff";
        tooltip.style.padding = "8px 12px";
        tooltip.style.borderRadius = "3px";
        tooltip.style.fontSize = "12px";
        tooltip.style.fontFamily = "Arial, sans-serif";
        tooltip.style.pointerEvents = "none";
        tooltip.style.display = "none";
        tooltip.style.zIndex = "10000";
        tooltip.style.whiteSpace = "nowrap";
        tooltip.id = "cf-custom-tooltip";
        document.body.appendChild(tooltip);
    }

    const ratingZones = [
        { from: -9999, to: 1200, color: "#ebebeb" }, // newbie
        { from: 1200, to: 1400, color: "#c8ffc8" }, // pupil
        { from: 1400, to: 1600, color: "#c8e8ff" }, // specialist
        { from: 1600, to: 1900, color: "#d2d2ff" }, // expert
        { from: 1900, to: 2100, color: "#ffc8ff" }, // candidate master
        { from: 2100, to: 2300, color: "#ffe0c8" }, // master
        { from: 2300, to: 2400, color: "#ffd0a0" }, // IM
        { from: 2400, to: 2600, color: "#ffb0b0" }, // GM
        { from: 2600, to: 3000, color: "#ff9090" }, // IGM
        { from: 3000, to: 10000, color: "#ff7070" }  // LGM
    ];

    let minRating = Math.min(...ratingPoints.map(p => p[1]));
    let maxRating = Math.max(...ratingPoints.map(p => p[1]));
    let maxRank = Math.max(...rankPoints.map(p => p[1]));
    minRating = Math.floor((minRating - 50) / 100) * 100;
    maxRating = Math.ceil((maxRating + 50) / 100) * 100;
    const rankAxisMax = Math.ceil(maxRank * 1.10);

    const dataSeries = [
        {
            data: ratingPoints,
            yaxis: 1,
            color: "#FFC843",
            lines: { show: true, lineWidth: 1.5 },
            points: { show: true, radius: 3, fill: true, fillColor: "#ffffff", lineWidth: 1.2, strokeColor: "#000000" },
            shadowSize: 0
        },
        {
            data: rankPoints,
            yaxis: 2,
            color: "#4d8fd6",
            lines: { show: true, lineWidth: 1, opacity: 0.5 },
            points: { show: true, radius: 3, fill: true, fillColor: "#ffffff", lineWidth: 1, strokeColor: "#4d8fd6" },
            shadowSize: 0
        }
    ];

    // Build custom x-axis ticks (show ~6 labels max)
    const tickInterval = Math.max(1, Math.ceil(history.length / 6));
    const xTicks = [];
    history.forEach((h, i) => {
        if (i % tickInterval === 0 || i === history.length - 1) {
            const d = new Date(h.ratingUpdateTimeSeconds * 1000);
            const m = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()];
            xTicks.push([i, `${("0"+d.getDate()).slice(-2)} ${m} ${d.getFullYear()}`]);
        }
    });

    const plot = $.plot($(container), dataSeries, {
        xaxis: {
            ticks: xTicks,
            tickColor: "#cfcfcf",
            font: { size: 11, family: "Verdana, Arial, sans-serif", color: "#545454" },
            min: -0.5,
            max: history.length - 0.5
        },
        yaxes: [
            {
                position: "left",
                tickDecimals: 0,
                min: minRating,
                max: maxRating,
                tickColor: "#cfcfcf",
                font: { size: 11, family: "Verdana, Arial, sans-serif", color: "#545454" },
                labelWidth: 48
            },
            {
                position: "right",
                tickDecimals: 0,
                transform: v => -v,
                inverseTransform: v => -v,
                min: 0,
                max: rankAxisMax,
                tickColor: "#e7e7e7",
                font: { size: 10, family: "Verdana, Arial, sans-serif", color: "#9d9d9d" },
                labelWidth: 42
            }
        ],
        grid: {
            hoverable: true,
            clickable: true,
            borderWidth: 1,
            borderColor: "#bfbfbf",
            backgroundColor: "#ffffff",
            markings: ratingZones.map(zone => ({ yaxis: { from: zone.from, to: zone.to }, color: zone.color })),
            margin: { top: 4, left: 4, bottom: 4, right: 4 }
        },
        legend: { show: false }
    });

    let currentHoverIndex = -1;
    let overlayCanvas = null;

    function getOverlayCanvas() {
        if (!overlayCanvas) {
            const existingOverlay = container.querySelector('.flot-overlay-custom');
            if (existingOverlay) {
                existingOverlay.remove();
            }
            
            overlayCanvas = document.createElement('canvas');
            overlayCanvas.className = 'flot-overlay-custom';
            overlayCanvas.style.position = 'absolute';
            overlayCanvas.style.left = '0';
            overlayCanvas.style.top = '0';
            overlayCanvas.style.pointerEvents = 'none';
            overlayCanvas.style.zIndex = '2';
            
            const plotOffset = plot.getPlotOffset();
            const baseCanvas = container.querySelector('canvas.flot-base');
            
            if (baseCanvas) {
                const rect = baseCanvas.getBoundingClientRect();
                overlayCanvas.width = baseCanvas.width;
                overlayCanvas.height = baseCanvas.height;
                overlayCanvas.style.width = baseCanvas.style.width;
                overlayCanvas.style.height = baseCanvas.style.height;
                container.style.position = 'relative';
                container.appendChild(overlayCanvas);
            }
        }
        return overlayCanvas;
    }

    function drawConnectionLine(index) {
        const canvas = getOverlayCanvas();
        if (!canvas || !plot) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const rating = history[index].newRating;
        const rank = history[index].rank;
        const xVal = index;

        const pRating = plot.pointOffset({ x: xVal, y: rating, yaxis: 1 });
        const pRank = plot.pointOffset({ x: xVal, y: rank, yaxis: 2 });

        const ratio = canvas.width / canvas.clientWidth;
        const xPixel = pRating.left * ratio;
        const ratingPixelY = pRating.top * ratio;
        const rankPixelY = pRank.top * ratio;
        const rankPixelX = pRank.left * ratio;

        const lowerY = Math.max(ratingPixelY, rankPixelY);
        const upperY = Math.min(ratingPixelY, rankPixelY);

        ctx.save();
        ctx.strokeStyle = '#8d8d8d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xPixel, upperY);
        ctx.lineTo(xPixel, lowerY);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.setLineDash([4,3]);
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xPixel, ratingPixelY);
        ctx.lineTo(rankPixelX, rankPixelY);
        ctx.stroke();
        ctx.restore();
    }

    function clearConnectionLine() {
        const canvas = getOverlayCanvas();
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    $(container).bind("plothover", function (event, pos, item) {
        if (!item) {
            tooltip.style.display = "none";
            currentHoverIndex = -1;
            clearConnectionLine();
            return;
        }

        const index = item.dataIndex;
        const h = history[index];

        if (currentHoverIndex !== index) {
            currentHoverIndex = index;
            drawConnectionLine(index);
        }

        const date = new Date(h.ratingUpdateTimeSeconds * 1000);
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const dateStr = `${("0" + date.getDate()).slice(-2)} ${months[date.getMonth()]} ${date.getFullYear()}`;

        const deltaRating = h.newRating - h.oldRating;
        const deltaStr = deltaRating > 0 ? `+${deltaRating}` : `${deltaRating}`;
        const deltaColor = deltaRating > 0 ? '#0a0' : (deltaRating < 0 ? '#f00' : '#888');

        tooltip.innerHTML = `
    <div style="font-weight:bold;margin-bottom:3px;">${h.contestName}</div>
    <div style="margin-bottom:3px;">${dateStr}</div>
    <div style="margin-bottom:3px;">Rank: ${h.rank}</div>
    <div>Rating: ${h.oldRating} → ${h.newRating} <span style="color:${deltaColor};font-weight:bold;">(${deltaStr})</span></div>`;

        const tooltipWidth = 300;
        const tooltipHeight = 100;
        let left = item.pageX + 15;
        let top = item.pageY - 10;

        if (left + tooltipWidth > window.innerWidth) {
            left = item.pageX - tooltipWidth - 15;
        }
        if (top + tooltipHeight > window.innerHeight) {
            top = window.innerHeight - tooltipHeight - 10;
        }
        if (top < 0) top = 10;

        tooltip.style.left = left + "px";
        tooltip.style.top = top + "px";
        tooltip.style.display = "block";
    });

    $(container).bind("mouseleave", function() {
        tooltip.style.display = "none";
        currentHoverIndex = -1;
        clearConnectionLine();
    });

})();
