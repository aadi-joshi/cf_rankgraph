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

    const ratingPoints = [];
    const rankPoints = [];

    history.forEach(h => {
        const t = h.ratingUpdateTimeSeconds * 1000;
        ratingPoints.push([t, h.newRating]);
        rankPoints.push([t, h.rank]);
    });

    container.innerHTML = "";

    let tooltip = document.getElementById("cf-custom-tooltip");
    if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.style.position = "absolute";
        tooltip.style.background = "rgba(255,255,255,0.9)";
        tooltip.style.padding = "6px 8px";
        tooltip.style.border = "1px solid #ccc";
        tooltip.style.borderRadius = "4px";
        tooltip.style.fontSize = "12px";
        tooltip.style.pointerEvents = "none";
        tooltip.style.display = "none";
        tooltip.id = "cf-custom-tooltip";
        document.body.appendChild(tooltip);
    }

    const plot = $.plot($(container), [
        {
            label: "Rating",
            data: ratingPoints,
            yaxis: 1,
            color: "#EDC240"
        },
        {
            label: "Rank (lower is better)",
            data: rankPoints,
            yaxis: 2,
            color: "#5C9DED"
        }
    ], {
        xaxis: {
            mode: "time",
            timeformat: "%d %b %y",
            minTickSize: [1, "day"]
        },
        yaxes: [
            {
                position: "left",
                tickDecimals: 0
            },
            {
                position: "right",
                tickDecimals: 0,
                transform: v => -v,
                inverseTransform: v => -v
            }
        ],
        grid: {
            hoverable: true,
            borderWidth: 1
        },
        legend: {
            position: "ne"
        }
    });

    $(container).bind("plothover", function (_, pos, item) {
        if (!item) {
            tooltip.style.display = "none";
            return;
        }

        const h = history[item.dataIndex];

        tooltip.innerHTML = `
            <b>${h.contestName}</b><br>
            Rating: ${h.newRating}<br>
            Rank: ${h.rank}
        `;

        tooltip.style.left = (item.pageX + 10) + "px";
        tooltip.style.top = (item.pageY + 10) + "px";
        tooltip.style.display = "block";
    });

})();
