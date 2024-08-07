import * as sauce from '/pages/src/../../shared/sauce/index.mjs';
import * as common from '/pages/src/common.mjs';

const doc       = document.documentElement;
const L         = sauce.locale;
const H         = L.human;
const num       = H.number;
const fieldsKey = 'nearby-fields-v2';
let imperial    = common.storage.get('/imperialUnits');
L.setImperial(imperial);
let eventSite   = common.storage.get('/externalEventSite', 'zwift');
let fieldStates;
let nearbyData;
let enFields;
let sortBy;
let sortByDir;
let table;
let tbody;
let theadRow;
let gameConnection;

common.settingsStore.setDefault({
    autoscroll     : true,
    refreshInterval: 2,
    overlayMode    : false,
    fontScale      : 1,
    solidBackground: false,
    backgroundColor: '#00ff00',
});

const unit = x => `<abbr class="unit">${x}</abbr>`;
const spd = (v, entry) => H.pace(v, {precision: 0, suffix: true, html: true, sport: entry.state.sport});
const weightClass = v => H.weightClass(v, {suffix: true, html: true});
const pwr = v => H.power(v, {suffix: true, html: true});
const hr = v => v ? num(v) + unit('bpm') : '-';
const kj = (v, options) => v != null ? num(v, options) + unit('kJ') : '-';
const pct = v => (v != null && !isNaN(v) && v !== Infinity && v !== -Infinity) ? num(v) + unit('%') : '-';
const gapTime = (v, entry) => H.timer(v) + (entry.isGapEst ? '<small> (est)</small>' : '');

let overlayMode;
if (window.isElectron) {
    overlayMode = !!window.electron.context.spec.overlay;
    doc.classList.toggle('overlay-mode', overlayMode);
    document.querySelector('#titlebar').classList.toggle('always-visible', overlayMode !== true);
    if (common.settingsStore.get('overlayMode') !== overlayMode) {
        // Sync settings to our actual window state, not going to risk updating the window now
        common.settingsStore.set('overlayMode', overlayMode);
    }
}


function makeLazyGetter(cb) {
    const getting = {};
    const cache = new Map();

    return function getter(key) {
        if (!cache.has(key)) {
            if (!getting[key]) {
                getting[key] = cb(key).then(value => {
                    cache.set(key, value || null);
                    if (!value) {
                        // Allow retry, especially for event data which is wonky
                        setTimeout(() => cache.delete(key), 10000);
                    }
                    delete getting[key];
                });
            }
            return;
        } else {
            return cache.get(key);
        }
    };
}


const lazyGetSubgroup = makeLazyGetter(id => common.rpc.getEventSubgroup(id));
const lazyGetRoute = makeLazyGetter(id => common.rpc.getRoute(id));



// const fieldGroups = [{
//     group: 'athlete',
//     label: 'Athlete',
//     fields: [
//         {id: 'actions', defaultEn: false, label: 'Action Button(s)', headerLabel: ' ', fmt: fmtActions},
//         {id: 'avatar', defaultEn: true, label: 'Avatar', headerLabel: '<ms>account_circle</ms>',
//          get: x => x.athlete && x.athlete.sanitizedFullname, fmt: fmtAvatar},
//         {id: 'nation', defaultEn: true, label: 'Country Flag', headerLabel: '<ms>flag</ms>',
//          get: x => x.athlete && x.athlete.countryCode, fmt: fmtFlag}, //common.fmtFlag
//         {id: 'name', defaultEn: true, label: 'Name', get: x => x.athlete && x.athlete.sanitizedFullname,
//          fmt: fmtName},
//         {id: 'f-last', defaultEn: false, label: 'F. Last', get: x => x.athlete && x.athlete.fLast,
//          fmt: fmtName},
//         {id: 'initials', defaultEn: false, label: 'Name Initials', headerLabel: ' ',
//          get: x => x.athlete && x.athlete.initials, fmt: fmtName},
//         {id: 'team', defaultEn: false, label: 'Team', get: x => x.athlete && x.athlete.team,
//          fmt: common.teamBadge},
//         {id: 'weight-class', defaultEn: false, label: 'Weight Class', headerLabel: 'Weight',
//          get: x => x.athlete && x.athlete.weight, fmt: weightClass},
//         {id: 'level', defaultEn: false, label: 'Level', get: x => x.athlete && x.athlete.level,
//          tooltip: 'The Zwift level of this athlete'},
//         {id: 'ftp', defaultEn: false, label: 'FTP', get: x => x.athlete && x.athlete.ftp,
//          fmt: x => x ? pwr(x) : '-', tooltip: 'Functional Threshold Power'},
//         {id: 'cp', defaultEn: false, label: 'CP', get: x => x.athlete && x.athlete.cp,
//          fmt: x => x ? pwr(x) : '-', tooltip: 'Critical Power'},
//         {id: 'tss', defaultEn: false, label: 'TSS', get: x => x.stats.power.tss, fmt: num,
//          tooltip: 'Training Stress Score'},
//         {id: 'intensity-factor', defaultEn: false, label: 'Intensity Factor', headerLabel: 'IF',
//          tootltip: 'Normalized Power / FTP: A value of 100% means NP = FTP', get: x => x.stats.power.np,
//          fmt: (x, entry) => pct(x / (entry.athlete && entry.athlete.ftp) * 100)},
//         {id: 'distance', defaultEn: false, label: 'Distance', headerLabel: 'Dist',
//          get: x => x.state.distance, fmt: fmtDist},
//         {id: 'event-distance', defaultEn: false, label: 'Event Distance', headerLabel: 'Ev Dist',
//          get: x => x.state.eventDistance, fmt: fmtDist},
//         {id: 'rideons', defaultEn: false, label: 'Ride Ons', headerLabel: '<ms>thumb_up</ms>',
//          get: x => x.state.rideons, fmt: num},
//         {id: 'kj', defaultEn: false, label: 'Energy (kJ)', headerLabel: 'kJ', get: x => x.state.kj, fmt: kj},
//         {id: 'wprimebal', defaultEn: false, label: 'W\'bal', get: x => x.stats.power.wBal,
//          tooltip: "W' and W'bal represent time above threshold and remaining energy respectively.\n" +
//          "Think of the W'bal value as the amount of energy in a battery.",
//          fmt: (x, entry) => (x != null && entry.athlete && entry.athlete.wPrime) ?
//             common.fmtBattery(x / entry.athlete.wPrime) + kj(x / 1000, {precision: 1}) : '-'},
//         {id: 'power-meter', defaultEn: false, label: 'Power Meter', headerLabel: 'PM',
//          get: x => x.state.powerMeter, fmt: x => x ? '<ms>check</ms>' : ''},
//     ],
// }, {
//     group: 'event',
//     label: 'Event / Road',
//     fields: [
//         {id: 'gap', defaultEn: true, label: 'Gap', get: x => x.gap, fmt: gapTime},
//         {id: 'gap-distance', defaultEn: false, label: 'Gap (dist)', get: x => x.gapDistance, fmt: fmtDist},
//         {id: 'game-laps', defaultEn: false, label: 'Game Lap', headerLabel: 'Z Lap',
//          get: x => x.state.laps + 1, fmt: num},
//         {id: 'sauce-laps', defaultEn: false, label: 'Sauce Lap', headerLabel: 'S Lap',
//          get: x => x.lapCount, fmt: num},
//         {id: 'remaining', defaultEn: false, label: 'Event/Route Remaining', headerLabel: '<ms>sports_score</ms>',
//          get: x => x.remaining, fmt: (v, entry) => entry.remainingMetric === 'distance' ? fmtDist(v) : fmtDur(v)},
//         {id: 'position', defaultEn: false, label: 'Event Position', headerLabel: 'Pos',
//          get: x => x.eventPosition, fmt: num},
//         {id: 'event', defaultEn: false, label: 'Event', headerLabel: '<ms>event</ms>',
//          get: x => x.state.eventSubgroupId, fmt: fmtEvent},
//         {id: 'route', defaultEn: false, label: 'Route', headerLabel: '<ms>route</ms>',
//          get: getRoute, fmt: fmtRoute},
//         {id: 'progress', defaultEn: false, label: 'Route %', headerLabel: 'RT %',
//          get: x => x.state.progress * 100, fmt: pct},
//         {id: 'workout-zone', defaultEn: false, label: 'Workout Zone', headerLabel: 'Zone',
//          get: x => x.state.workoutZone, fmt: x => x || '-'},
//         {id: 'road', defaultEn: false, label: 'Road ID', get: x => x.state.roadId},
//         {id: 'roadcom', defaultEn: false, label: 'Road Completion', headerLabel: 'Road %',
//          get: x => x.state.roadCompletion / 10000, fmt: pct},
//     ],
// },  {
//     group: 'debug',
//     label: 'Debug',
//     fields: [
//         //{id: 'index', defaultEn: false, label: 'Data Index', headerLabel: 'Idx', get: x => x.index},
//         {id: 'id', defaultEn: false, label: 'Athlete ID', headerLabel: 'ID', get: x => x.athleteId},
//         {id: 'course', defaultEn: false, label: 'Course (aka world)', headerLabel: '<ms>map</ms>',
//          get: x => x.state.courseId},
//         {id: 'direction', defaultEn: false, label: 'Direction', headerLabel: 'Dir',
//          get: x => x.state.reverse, fmt: x => x ? '<ms>arrow_back</ms>' : '<ms>arrow_forward</ms>'},
//         {id: 'latency', defaultEn: false, label: 'Latency',
//          get: x => x.state.latency, fmt: x => H.number(x, {suffix: 'ms', html: true})},
//         {id: 'power-up', defaultEn: false, label: 'Active Power Up', headerLabel: 'PU',
//          get: x => x.state.activePowerUp, fmt: x => x ? x.toLowerCase() : ''},
//         {id: 'event-leader', defaultEn: false, label: 'Event Leader', headerLabel: '<ms>star</ms>',
//          get: x => x.eventLeader, fmt: x => x ? '<ms style="color: gold">star</ms>' : ''},
//         {id: 'event-sweeper', defaultEn: false, label: 'Event Sweeper', headerLabel: '<ms>mop</ms>',
//          get: x => x.eventSweeper, fmt: x => x ? '<ms style="color: darkred">mop</ms>' : ''},
//     ],
// }];


export async function main() {
    common.initInteractionListeners();
    // common.initNationFlags();  // bg okay
    let onlyMarked       = common.settingsStore.get('onlyMarked');
    let onlySameCategory = common.settingsStore.get('onlySameCategory');
    let onlySameTeam     = common.settingsStore.get('onlySameTeam');
    let refresh;
    const setRefresh = () => {
        refresh = (common.settingsStore.get('refreshInterval') || 0) * 1000 - 100; // within 100ms is fine.
    };
    const gcs = await common.rpc.getGameConnectionStatus();
    gameConnection = !!(gcs && gcs.connected);
    doc.classList.toggle('game-connection', gameConnection);
    common.subscribe('status', gcs => {
        gameConnection = gcs.connected;
        doc.classList.toggle('game-connection', gameConnection);
    }, {source: 'gameConnection'});
    common.settingsStore.addEventListener('changed', async ev => {
        const changed = ev.data.changed;
        if (changed.has('solidBackground') || changed.has('backgroundColor')) {
            setBackground();
        }
        if (window.isElectron && changed.has('overlayMode')) {
            await common.rpc.updateWindow(window.electron.context.id,
                {overlay: changed.get('overlayMode')});
            await common.rpc.reopenWindow(window.electron.context.id);
        }
        if (changed.has('refreshInterval')) {
            setRefresh();
        }
        if (changed.has('onlyMarked')) {
            onlyMarked = changed.get('onlyMarked');
        }
        if (changed.has('onlySameCategory')) {
            onlySameCategory = changed.get('onlySameCategory');
        }
        if (changed.has('onlySameTeam')) {
            onlySameTeam = changed.get('onlySameTeam');
        }

        render();
        if (nearbyData) {
            renderData(nearbyData);
        }
    });
    common.storage.addEventListener('update', async ev => {
        if (ev.data.key === fieldsKey) {
            fieldStates = ev.data.value;
            render();
            if (nearbyData) {
                renderData(nearbyData);
            }
        }
    });
    common.storage.addEventListener('globalupdate', ev => {
        if (ev.data.key === '/imperialUnits') {
            L.setImperial(imperial = ev.data.value);
        } else if (ev.data.key === '/exteranlEventSite') {
            eventSite = ev.data.value;
        }
    });
    setBackground();
    const fields = [].concat(...fieldGroups.map(x => x.fields));
    fieldStates = common.storage.get(fieldsKey, Object.fromEntries(fields.map(x => [x.id, x.defaultEn])));
    render();
    tbody.addEventListener('dblclick', async ev => {
        const row = ev.target.closest('tr');
        if (row) {
            clearSelection();
            if (gameConnection) {
                await watch(Number(row.dataset.id));
            }
        }
    });

    setRefresh();
    let lastRefresh = 0;
    common.subscribe('nearby', data => {
        if (onlyMarked) {
            data = data.filter(x => x.watching || (x.athlete && x.athlete.marked));
        }
        if (onlySameCategory) {
            const watching = data.find(x => x.watching);
            const sgid = watching && watching.state.eventSubgroupId;
            if (sgid) {
                data = data.filter(x => x.state.eventSubgroupId === sgid);
            }
        }
        if (onlySameTeam) {
            const watching = data.find(x => x.watching);
            const team = watching && watching.athlete.team;
            if (team) {
                data = data.filter(x => x.athlete && (x.athlete.team === team));
            }
        }
        nearbyData = data;
        const elapsed = Date.now() - lastRefresh;
        if (elapsed >= refresh) {
            lastRefresh = Date.now();
            renderData(data);
        }
    });
}


async function watch(athleteId) {
    await common.rpc.watch(athleteId);
    if (nearbyData) {
        for (const x of nearbyData) {
            x.watching = x.athleteId === athleteId;
        }
        renderData(nearbyData);
    }
}


function render() {
    // doc.classList.toggle('autoscroll', common.settingsStore.get('autoscroll'));
    // doc.style.setProperty('--font-scale', common.settingsStore.get('fontScale') || 1);
    // const fields = [].concat(...fieldGroups.map(x => x.fields));
    // enFields = fields.filter(x => fieldStates[x.id]);
    // sortBy = common.storage.get('nearby-sort-by', 'gap');
    // const isFieldAvail = !!enFields.find(x => x.id === sortBy);
    // if (!isFieldAvail) {
    //     sortBy = enFields[0].id;
    // }
    // sortByDir = common.storage.get('nearby-sort-dir', -1);
    // const sortDirClass = sortByDir > 0 ? 'sort-asc' : 'sort-desc';
    // table = document.querySelector('#content table');
    // tbody = table.querySelector('tbody');
    // tbody.innerHTML = '';
    // theadRow = table.querySelector('thead tr');
    // theadRow.innerHTML = enFields.map(x =>
    //     `<td data-id="${x.id}"
    //          title="${common.sanitizeAttr(x.tooltip || x.label || '')}"
    //          class="${sortBy === x.id ? 'sorted ' + sortDirClass : ''}"
    //          >${x.headerLabel || x.label}` +
    //             `<ms class="sort-asc">arrow_drop_up</ms>` +
    //             `<ms class="sort-desc">arrow_drop_down</ms></td>`).join('');
}



let frames = 0;
function renderData(data, {recenter}={}) {
    if (!data || !data.length || document.hidden) {
        return;
    }
    // const sortField = enFields.find(x => x.id === sortBy);
    // const sortGet = sortField && (sortField.sortValue || sortField.get);
    // if (sortGet) {
    //     data.sort((a, b) => {
    //         let av = sortGet(a);
    //         let bv = sortGet(b);
    //         if (Array.isArray(av)) {
    //             av = av[0];
    //         }
    //         if (Array.isArray(bv)) {
    //             bv = bv[0];
    //         }
    //         if (av == bv) {
    //             return 0;
    //         } else if (av == null || bv == null) {
    //             return av == null ? 1 : -1;
    //         } else if (typeof av === 'number') {
    //             return (av < bv ? 1 : -1) * sortByDir;
    //         } else {
    //             return (('' + av).toLowerCase() < ('' + bv).toLowerCase() ? 1 : -1) * sortByDir;
    //         }
    //     });
    // }
    // const centerIdx = data.findIndex(x => x.watching);
    // const watchingRow = tbody.querySelector('tr.watching') || tbody.appendChild(makeTableRow());
    // let row = watchingRow;
    // for (let i = centerIdx; i >= 0; i--) {
    //     updateTableRow(row, data[i]);
    //     if (i) {
    //         row = row.previousElementSibling || row.insertAdjacentElement('beforebegin', makeTableRow());
    //     }
    // }
    // while (row.previousElementSibling) {
    //     gentleClassToggle(row = row.previousElementSibling, 'hidden', true);
    // }
    // row = watchingRow;
    // for (let i = centerIdx + 1; i < data.length; i++) {
    //     row = row.nextElementSibling || row.insertAdjacentElement('afterend', makeTableRow());
    //     updateTableRow(row, data[i]);
    // }
    // while (row.nextElementSibling) {
    //     gentleClassToggle(row = row.nextElementSibling, 'hidden', true);
    // }
    // if ((!frames++ || recenter) && common.settingsStore.get('autoscroll')) {
    //     requestAnimationFrame(() => {
    //         const row = tbody.querySelector('tr.watching');
    //         if (row) {
    //             row.scrollIntoView({block: 'center'});
    //         }
    //     });
    // }
}


function setBackground() {
    const {solidBackground, backgroundColor} = common.settingsStore.get();
    doc.classList.toggle('solid-background', !!solidBackground);
    if (solidBackground) {
        doc.style.setProperty('--background-color', backgroundColor);
    } else {
        doc.style.removeProperty('--background-color');
    }
}


export async function settingsMain() {
    common.initInteractionListeners();
    // fieldStates = common.storage.get(fieldsKey);
    // const form = document.querySelector('form#fields');
    form.addEventListener('input', ev => {
        const id = ev.target.name;
        fieldStates[id] = ev.target.checked;
        common.storage.set(fieldsKey, fieldStates);
    });
    // for (const {fields, label} of fieldGroups) {
    //     form.insertAdjacentHTML('beforeend', [
    //         '<div class="field-group">',
    //             `<div class="title">${label}:</div>`,
    //             ...fields.map(x => `
    //                 <label title="${common.sanitizeAttr(x.tooltip || '')}">
    //                     <key>${x.label}</key>
    //                     <input type="checkbox" name="${x.id}" ${fieldStates[x.id] ? 'checked' : ''}/>
    //                 </label>
    //             `),
    //         '</div>'
    //     ].join(''));
    // }
    await common.initSettingsForm('form#options')();
}
