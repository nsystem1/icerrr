
var ch = {};
ch.skipsetkeys = [];

ch.init = function() {

    console.debug("ch.init()");

    var canvas;
    var ctx;

    // convert all data
    data.byversion = JSON.parse(data.byversions);
    data.bymodel = JSON.parse(data.bymodels);
    data.byplatform = JSON.parse(data.byplatforms);

    // Extend all data
    data.byversionext = jQuery.extend(true, {}, data.byversion);
    data.bymodelext = jQuery.extend(true, {}, data.bymodel);
    data.byplatformext = jQuery.extend(true, {}, data.byplatform);

    // set global config for chart_byversion
    Chart.defaults.global.multiTooltipTemplate = "<%if (datasetLabel ){%><%=datasetLabel %>: <%}%><%= value %>";
    Chart.defaults.global.animation = false;

    // chart_byversion
    console.log(" -> by_version");
    ch.drawChart("byversion",data.byversionext,"chart_byversion");

    // chart_bymodel
    console.log(" -> by_bymodel");
    //ch.drawChart(data.bymodel,"chart_bymodel","pie");
    ch.drawChartTotals("bymodel",data.bymodelext,"chart_bymodel");

    // chart_byplatform
    console.log(" -> by_byplatform");
    ch.drawChartTotals("byplatform",data.byplatformext,"chart_byplatform");


}

ch.toggleDataSet = function(datakey, setkey, canvasid) {

    console.debug("ch.toggleDataSet(): "+ datakey +", "+ setkey +", "+ canvasid);

    var newdataset = {};

    // First check if key already disabled..
    var setkeyIsDisabled = (ch.skipsetkeys.indexOf(setkey)>=0) ? true : false;
    var setkeyIndex = ch.skipsetkeys.indexOf(setkey);

    console.log(" > setkeyIndex: "+ setkeyIndex)

    // Is disabled (add it back)
    if (setkeyIsDisabled) {
        ch.skipsetkeys.splice(setkeyIndex,1);
    }

    // Is not disabled (remove it)
    else {
        ch.skipsetkeys.push(setkey);
    }

    // (Re)draw the chart
    ch.drawChart(datakey,data[datakey+"ext"],canvasid);

}

ch.drawChart = function(datakey,thedata,canvasid,type) {

    console.debug("ch.drawChart(): "+ canvasid);

    // -> Canvas, ctx
    canvas = document.getElementById(canvasid);
    ctx = canvas.getContext("2d");

    // - First entry..
    var entry1 = null;
    var entry2 = {time:0};
    for (var key in thedata) {
        for (var i in thedata[key]["datas"]) {
            if (!entry1) { entry1 = thedata[key]["datas"][i]; }
            if (entry2.time < thedata[key]["datas"][i].time) {
                entry2 = thedata[key]["datas"][i];
            }
        }
    }
    entry1.timems = (entry1.time*1000);//-86400000; // -1 day
    var date1 = new Date();
    date1.setTime(entry1.timems);
    entry2.timems = (entry2.time*1000); //+86400000; // +1 day
    var date2 = new Date();
    date2.setTime(entry2.timems);

    // -> Data..
    var chdata = {};
    chdata.labels = [];
    chdata.datasets = [];
    var datasetsByKey = {};
    var doneids = {};

    // Gather..
    console.log(" -> Daterange..");
    console.log(" --> "+ date1.format("Y-m-d") +", "+ date2.format("Y-m-d"));

    // Gogo
    for (var key in thedata) {

        //console.log(" -> "+ key);

        var randcolor = Math.round(Math.random()*255)+","+ Math.round(Math.random()*255)+","+ Math.round(Math.random()*255);
        var dataset = {};
        dataset.label = key;
        dataset.fillColor = "rgba("+ randcolor +",0.08)";
        dataset.strokeColor = "rgba("+ randcolor +",0.75)";

        var tempdatasetday = -1;
        var tempdataset = {};
        var tempdataids = [];

        for (var t=entry1.timems; t<=entry2.timems; t+=86400000) {

            tempdatasetday++;

            var datet = new Date();
            datet.setTime(t);
            var datetstr = datet.format("Y-m-d");

            if (chdata.labels.indexOf(datetstr)<0) {
                chdata.labels.push(datetstr);
            }

            var founddataforday = false;

            for (var i=0; i<thedata[key]["datas"].length; i++) {

                var entry =  thedata[key]["datas"][i];
                var timems = entry.time*1000;
                var date = new Date();
                date.setTime(timems);
                var datestr = date.format("Y-m-d");
                if (datetstr==datestr) {

                    if (tempdataids.indexOf(entry.id)>=0) {
                        continue;
                    }
                    tempdataids.push(entry.id);

                    founddataforday = true;

                    if (!tempdataset[datetstr]) {
                        tempdataset[datetstr] = 1;
                    } else {
                        tempdataset[datetstr] ++;
                    }

                    // minus?
                    var keysAndIndexes = ch.getDataIndexesById(thedata,entry.id,entry.time);
                    for (var j=0; j<keysAndIndexes.length; j++) {
                        var dikey = keysAndIndexes[j].key;
                        var diindex = keysAndIndexes[j].index;
                        var didata = thedata[dikey]["datas"][diindex];
                        didata.timems = didata.time*1000;
                        //console.warn(" ----> "+ dikey +", "+ didata.id);
                        var didate = new Date();
                        didate.setTime(didata.timems);
                        var didatestr = didate.format("Y-m-d");
                        if (tempdataset[datetstr] && tempdataset[datetstr]>0 && parseFloat(dikey)<parseFloat(key)) {

                            if (!doneids[didata.id]) { doneids[didata.id] = []; }
                            if (doneids[didata.id].indexOf(dikey)>=0) {
                                //console.error(" -> SKIP SKIP ");
                                continue;
                            }
                            doneids[didata.id].push(dikey);

                            var ditempdatasetday = tempdatasetday;
                            for (var did=tempdatasetday; did<datasetsByKey[dikey].data.length; did++) {
                                //console.warn(" -----> "+ dikey +", "+ ditempdatasetday +", "+ datasetsByKey[dikey].data[did]);
                                datasetsByKey[dikey].data[did] -= 1;
                            }

                        }
                    }

                }

            }

            if (!founddataforday) {
                tempdataset[datetstr] = 0;
            } else {}

        }

        var total = 0;
        dataset.data = [];
        for (var t=entry1.timems; t<=entry2.timems; t+=86400000) {
            var date = new Date();
            date.setTime(t);
            var d = date.format("Y-m-d");
            total = total+tempdataset[d];
            dataset.data.push(total);
        }
        datasetsByKey[key] = dataset;

    }

    // Store
    chdata_setkeys = [];
    for (var key in datasetsByKey) {
        if (ch.skipsetkeys.indexOf(key)<0) { chdata.datasets.push(datasetsByKey[key]); }
        chdata_setkeys.push(datasetsByKey[key]);
    }


    // Chart!
    if (!type) {
        var thechart = new Chart(ctx).Line(chdata, {});
    } else if (type=="bar") {
        var thechart = new Chart(ctx).Bar(chdata, {});
    } else if (type="pie") {
        ch.drawChartTotals(thedata,canvasid,type);
    }

    // Legend..
    ch.drawChartLegend(datakey,canvasid,chdata,chdata_setkeys);

}

ch.drawChartTotals = function(datakey,thedata,canvasid,type) {

    console.debug("ch.drawChartTotals(): "+ canvasid);

    // -> Canvas, ctx
    canvas = document.getElementById(canvasid);
    ctx = canvas.getContext("2d");

    // Build data
    var chdata = [];
    for (var key in thedata) {

        //console.log(" -> "+ key +", "+ thedata[key].entries);

        var randcolor = Math.round(Math.random()*255)+","+ Math.round(Math.random()*255)+","+ Math.round(Math.random()*255);

        var newentry = {};
        newentry.value = thedata[key].entries;
        newentry.color = "rgba("+ randcolor +",0.25)";
        newentry.highlight = "rgba("+ randcolor +",0.75)";
        newentry.label = key;

        chdata.push(newentry);

    }

    // The chart
    var thechart = new Chart(ctx).Pie(chdata, {});


}

ch.drawChartLegend = function(datakey,canvasid,chdata,chdata_setkeys) {

    console.debug("ch.drawChartLegend(): "+ canvasid);

    $($("#"+canvasid)[0].parentNode).children(".legendWrap").html("");

    var elem = document.createElement("div");
    elem.className = "legendWrap";

    for (var i in chdata_setkeys) {

        var dataset = chdata_setkeys[i];
        var color = dataset.strokeColor;
        var label = dataset.label;

        var opac = 1.0;
        if (ch.skipsetkeys.indexOf(label)>=0) {
            opac = 0.25;
        }

        elem.innerHTML += "<div style='display:inline-block; width:144px; margin-bottom:8px; cursor:pointer; opacity:"+ opac +"' onclick='ch.toggleDataSet(\""+ datakey +"\",\""+ label +"\",\""+ canvasid +"\");'>"
                    +"<div style='display:inline-block; width:12px; height:12px; margin:4px; background-color:"+ color +"'></div>"
                    +"<div style='display:inline-block; margin-left:8px;'>"+ label +"</div>"
                    +"</div>";

    }

    $("#"+canvasid).after(elem);

}

// Lookups

// getDataIndexesById
ch.getDataIndexesById = function(data,id,time) {

    //console.log("ch.getDataIndexesById(): "+id);

    var res = [];

    //console.log(JSON.stringify(datas));

    for (var key in data) {

        var ob = null;
        for (var i=0; i<data[key].datas.length; i++) {

            if (id==data[key].datas[i].id && time!=data[key].datas[i].time) {
                ob = {key:key,index:i};
            }

        }
        if (ob) {
            res.push(ob);
        }

    }

    //console.log(JSON.stringify(res));

    //console.log(" -> ch.getDataIndexesById().DONE: "+ res.length +" result(s)");
    return res;

}

























/* EOF */
