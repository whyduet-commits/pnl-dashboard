"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTheme } from "@/lib/theme";

// ── 학원 목록 ─────────────────────────────────────────────────
const ORG_LIST = [
  { id: 2,  name: "강남"      },
  { id: 3,  name: "목동"      },
  { id: 4,  name: "분당"      },
  { id: 5,  name: "대구"      },
  { id: 6,  name: "대전"      },
  { id: 7,  name: "최상위권"  },
  { id: 8,  name: "남학생"    },
  { id: 9,  name: "여학생"    },
  { id: 10, name: "종합관"    },
  { id: 11, name: "대치"      },
];

const PGLBL: Record<number, string> = {
  1:"B1F",2:"1F 서측",3:"1F 동측",4:"2F 북측",5:"2F 남측",6:"6F 북측",7:"6F 남측",
};

const PRE = [
  {l:"1:50",v:50},{l:"1:100",v:100},{l:"1:150",v:150},
  {l:"1:200",v:200},{l:"1:250",v:250},{l:"1:300",v:300},{l:"1:500",v:500},
];

const PKEYS = ["_t","_st","_lb","_bg","_gr","_dw","_dh","_px","_mm"];
const HMAX  = 30;

type Tool = "select"|"seat"|"text"|"wall"|"calib"|"measure";
type StType = "study"|"lecture";

export default function FloorEdit() {
  const { T, theme } = useTheme();

  // ── refs ──────────────────────────────────────────────────────
  const canvasRef  = useRef<HTMLCanvasElement | null>(null); // JS로 직접 생성
  const cvRef      = useRef<any>(null);          // fabric.Canvas
  const wrapRef    = useRef<HTMLDivElement>(null);

  // ── state ─────────────────────────────────────────────────────
  const [selectedOrg, setSelectedOrg] = useState<number>(0);
  const [pdfStatus,   setPdfStatus]   = useState<"none"|"loading"|"loaded"|"missing">("none");
  const [saveStatus,  setSaveStatus]  = useState<"idle"|"saving"|"saved"|"error">("idle");
  const [loadStatus,  setLoadStatus]  = useState<"idle"|"loading">("idle");

  const [tool,     setToolState]  = useState<Tool>("select");
  const [stType,   setStType]     = useState<StType>("study");
  const [seatCount,setSeatCount]  = useState(0);
  const [roomStats,setRoomStats]  = useState<Record<string,number>>({});
  const [selProps, setSelProps]   = useState<any>(null);
  const [zoom,     setZoomState]  = useState(1);

  const [curPage,  setCurPage]    = useState(1);
  const [totPages, setTotPages]   = useState(0);
  const [fname,    setFname]      = useState("");

  const [pxMm,     setPxMm]       = useState<number|null>(null);
  const [scaleLabel, setScaleLabel] = useState("축척 미설정");

  const [snapOn,   setSnapOn]     = useState(true);
  const [mlVis,    setMlVis]      = useState(true);
  const [mlog,     setMlog]       = useState<{px:number;mm:number|null}[]>([]);

  // modal states
  const [showSM,   setShowSM]     = useState(false);
  const [showCD,   setShowCD]     = useState(false);
  const [selPreset,setSelPreset]  = useState(100);
  const [rscale,   setRscale]     = useState(1.5);
  const [cdPxVal,  setCdPxVal]    = useState(0);
  const [cdMm,     setCdMm]       = useState(1000);
  const [hint,     setHint]       = useState("");

  // mutable refs (avoid stale closures)
  const toolRef    = useRef<Tool>("select");
  const stTypeRef  = useRef<StType>("study");
  const snapRef    = useRef(true);
  const pxMmRef    = useRef<number|null>(null);
  const mlVisRef   = useRef(true);
  const histRef    = useRef<string[]>([]);
  const hIdxRef    = useRef(-1);
  const wallRef    = useRef<{draw:boolean;pt:any;prev:any}>({draw:false,pt:null,prev:null});
  const msRef      = useRef<{state:number;pt:any;prev:any}>({state:0,pt:null,prev:null});
  const cbRef      = useRef<{state:number;pt:any;prev:any;lines:any[];tmp:any}>({state:0,pt:null,prev:null,lines:[],tmp:null});
  const pdfRef     = useRef<any>(null);
  const curPageRef = useRef(1);
  const pdfWRef    = useRef(0);
  const pdfHRef    = useRef(0);
  const fnameRef   = useRef("");
  const mlogRef    = useRef<{px:number;mm:number|null}[]>([]);
  const [mpopText, setMpopText] = useState("");
  const [mpopVis,  setMpopVis]  = useState(false);
  const [undoOk,   setUndoOk]   = useState(false);
  const [redoOk,   setRedoOk]   = useState(false);
  const calibTmpRef = useRef<{px:number;mm:number|null}|null>(null);

  // ── helpers ───────────────────────────────────────────────────
  const mm2px = useCallback((mm:number) => pxMmRef.current ? mm * pxMmRef.current : null, []);
  const px2mm = useCallback((px:number) => pxMmRef.current ? px / pxMmRef.current : null, []);
  const fmm   = (mm:number|null) => {
    if (mm==null) return "—";
    return mm>=1000 ? (mm/1000).toFixed(2)+"m" : Math.round(mm)+"mm";
  };
  const dst = (a:any,b:any) => Math.sqrt((b.x-a.x)**2+(b.y-a.y)**2);
  const snp = (pt:any) => ({ x:Math.round(pt.x/20)*20, y:Math.round(pt.y/20)*20 });

  // ── Fabric / PDF.js 로드 ──────────────────────────────────────
  const loadScripts = useCallback(() => new Promise<void>((resolve) => {
    const setPdfWorker = () => {
      if ((window as any).pdfjsLib)
        (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    };

    // 이미 둘 다 로드된 경우
    if ((window as any).fabric && (window as any).pdfjsLib) {
      setPdfWorker(); resolve(); return;
    }

    const loadOne = (src: string): Promise<void> => new Promise((res) => {
      // 이미 같은 src의 스크립트가 있으면 로드 완료 대기
      const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null;
      if (existing) {
        if (existing.dataset.loaded) { res(); return; }
        existing.addEventListener("load", () => res(), { once: true });
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.dataset.loaded = "0";
      s.onload = () => { s.dataset.loaded = "1"; res(); };
      s.onerror = () => res(); // 오류나도 진행
      // document.body에 추가 (React DOM과 충돌 없음)
      document.body.appendChild(s);
    });

    const needed: string[] = [];
    if (!(window as any).fabric)
      needed.push("https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js");
    if (!(window as any).pdfjsLib)
      needed.push("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");

    Promise.all(needed.map(loadOne)).then(() => { setPdfWorker(); resolve(); });
  }), []);

  // ── Canvas 초기화 ─────────────────────────────────────────────
  const initCanvas = useCallback(() => {
    if (!wrapRef.current) return;
    if (cvRef.current) return; // 이미 초기화됨
    const fabric = (window as any).fabric;
    if (!fabric) return;
    const wrap = wrapRef.current;

    // canvas를 React JSX 외부에서 직접 생성 (React DOM 충돌 방지)
    const canvasEl = document.createElement("canvas");
    canvasEl.id = "flooredit-canvas-el";
    const ccDiv = wrap.querySelector("#flooredit-cc");
    if (!ccDiv) return;
    // 기존 canvas 제거
    const old = ccDiv.querySelector("canvas");
    if (old) old.remove();
    ccDiv.appendChild(canvasEl);
    canvasRef.current = canvasEl;

    const cv = new fabric.Canvas(canvasEl, {
      width: wrap.clientWidth || 900,
      height: wrap.clientHeight || 600,
      backgroundColor: theme === "dark" ? "#090c12" : "#f0f0f0",
      selection: true,
    });
    cvRef.current = cv;

    window.addEventListener("resize", () => {
      cv.setWidth(wrap.clientWidth);
      cv.setHeight(wrap.clientHeight);
      cv.renderAll();
    });

    // 이벤트
    cv.on("mouse:down",  (e:any) => onMD(e));
    cv.on("mouse:move",  (e:any) => onMM(e));
    cv.on("mouse:up",    (e:any) => onMU(e));
    cv.on("mouse:wheel", (e:any) => onMW(e));
    cv.on("selection:created", () => onSel());
    cv.on("selection:updated", () => onSel());
    cv.on("selection:cleared", () => { setSelProps(null); });
    cv.on("object:modified", () => { saveH(); updCnt(); });

    // Pan (middle-click or alt+drag)
    let pan = false, lp: any = null;
    cv.on("mouse:down", (e:any) => {
      if (e.e.button===1||(e.e.button===0&&e.e.altKey)) {
        pan=true; lp={x:e.e.clientX,y:e.e.clientY}; cv.defaultCursor="grabbing";
      }
    });
    cv.on("mouse:move", (e:any) => {
      if (pan&&lp) { cv.relativePan({x:e.e.clientX-lp.x,y:e.e.clientY-lp.y}); lp={x:e.e.clientX,y:e.e.clientY}; }
    });
    cv.on("mouse:up", () => { if(pan){pan=false;lp=null;cv.defaultCursor="default";} });

    document.addEventListener("keydown", onKey);
  }, [theme]);

  useEffect(() => {
    loadScripts().then(initCanvas);
    return () => {
      document.removeEventListener("keydown", onKey);
      // 컴포넌트 언마운트 시 Fabric canvas 완전 제거 (다른 canvas와 충돌 방지)
      if (cvRef.current) {
        try { cvRef.current.dispose(); } catch(e) {}
        cvRef.current = null;
      }
      // DOM에서 canvas 엘리먼트 직접 제거
      const el = document.getElementById("flooredit-canvas-el");
      if (el) el.remove();
      canvasRef.current = null;
    };
  }, []);

  // ── 학원 선택 시 도면 로드 ────────────────────────────────────
  useEffect(() => {
    if (!selectedOrg) return;
    loadFloorPlan(selectedOrg);
  }, [selectedOrg]);

  const loadFloorPlan = async (orgId: number) => {
    setPdfStatus("loading");
    try {
      // PDF를 API route를 통해 서버에서 프록시 (CORS/인증 문제 방지)
      const pdfRes = await fetch(`/api/floor?org_id=${orgId}&action=pdf`);
      if (!pdfRes.ok) { setPdfStatus("missing"); return; }

      await loadScripts();
      if (!cvRef.current) initCanvas();

      const buf = await pdfRes.arrayBuffer();
      const pdfjsLib = (window as any).pdfjsLib;
      const doc = await pdfjsLib.getDocument({ data: buf }).promise;
      pdfRef.current  = doc;
      setTotPages(doc.numPages);
      await renderPage(1);

      // 저장된 배치 데이터 불러오기
      const lr = await fetch(`/api/floor?org_id=${orgId}&action=layout`);
      const { layout } = await lr.json();
      if (layout && cvRef.current) {
        cvRef.current.loadFromJSON(layout, () => {
          cvRef.current.renderAll();
          updCnt();
        });
      }
      setPdfStatus("loaded");
    } catch (e) {
      console.error(e);
      setPdfStatus("missing");
    }
  };

  const renderPage = async (n: number) => {
    if (!pdfRef.current || !cvRef.current) return;
    curPageRef.current = n;
    setCurPage(n);
    const cv   = cvRef.current;
    const fabric = (window as any).fabric;
    const pg   = await pdfRef.current.getPage(n);
    const vp   = pg.getViewport({ scale: 1.5 });
    pdfWRef.current = vp.width;
    pdfHRef.current = vp.height;
    const off = document.createElement("canvas");
    off.width  = vp.width;
    off.height = vp.height;
    await pg.render({ canvasContext: off.getContext("2d"), viewport: vp }).promise;
    cv.getObjects("image").forEach((o:any) => { if(o._bg) cv.remove(o); });
    fabric.Image.fromURL(off.toDataURL(), (img:any) => {
      img._bg = true;
      img.set({ left:20, top:20, selectable:false, evented:false, hoverCursor:"default" });
      cv.add(img); cv.sendToBack(img);
      const s = Math.min((cv.width-40)/vp.width, (cv.height-40)/vp.height, 1);
      cv.setViewportTransform([s,0,0,s,20,20]);
      setZoomState(s);
      cv.renderAll();
    });
  };

  // ── 도구 설정 ─────────────────────────────────────────────────
  const setTool = (t: Tool) => {
    if (!cvRef.current) return;
    const cv = cvRef.current;
    if (toolRef.current==="calib") cleanCB();
    if (toolRef.current==="measure") cleanMS();
    if (toolRef.current==="wall") {
      wallRef.current.draw=false; wallRef.current.pt=null;
      if (wallRef.current.prev) { cv.remove(wallRef.current.prev); wallRef.current.prev=null; }
    }
    toolRef.current = t;
    setToolState(t);
    cv.selection = t==="select";
    cv.defaultCursor = ({select:"default",seat:"crosshair",text:"text",wall:"crosshair",calib:"crosshair",measure:"crosshair"} as any)[t]||"default";
    const hints: Record<string,string> = {
      seat:"🪑 클릭하여 좌석 배치 | Esc 취소",
      text:"T 클릭하여 텍스트 추가",
      wall:"▐ 시작점 클릭 → 끝점 클릭 | Esc 취소",
      calib:"📐 1번째 점 → 2번째 점 클릭 → 실거리 입력",
      measure:"📏 시작점 → 끝점 클릭 | Esc 취소",
    };
    setHint(hints[t] ?? "");
  };

  const selSt = (t: StType) => { stTypeRef.current=t; setStType(t); setTool("seat"); };

  // ── 마우스 이벤트 ─────────────────────────────────────────────
  const mkL = (p1:any,p2:any,col:string,sw:number,dash:number[]) => {
    const fabric = (window as any).fabric;
    return new fabric.Line([p1.x,p1.y,p2.x,p2.y],{stroke:col,strokeWidth:sw,strokeDashArray:dash,selectable:false,evented:false});
  };

  function onMD(e:any) {
    if (e.e.button===1||(e.e.button===0&&e.e.altKey)) return;
    const cv = cvRef.current; if(!cv) return;
    const pt = cv.getPointer(e.e);
    const sn = snapRef.current ? snp(pt) : pt;
    const t  = toolRef.current;
    if (t==="calib")  { hCalib(sn); return; }
    if (t==="measure"){ hMeas(sn);  return; }
    const bg = !e.target||e.target._bg;
    if (t==="seat"   && bg) { placeSeat(sn.x,sn.y); saveH(); }
    else if (t==="text"&& bg) { placeTxt(sn.x,sn.y); }
    else if (t==="wall"&& !wallRef.current.draw) { wallRef.current.draw=true; wallRef.current.pt=sn; }
  }

  function onMM(e:any) {
    const cv = cvRef.current; if(!cv) return;
    const pt = cv.getPointer(e.e);
    const sn = snapRef.current ? snp(pt) : pt;
    const t  = toolRef.current;
    if (t==="wall"&&wallRef.current.draw&&wallRef.current.pt) {
      if (wallRef.current.prev) cv.remove(wallRef.current.prev);
      wallRef.current.prev = mkL(wallRef.current.pt,sn,"#94a3b8",6,[]);
      cv.add(wallRef.current.prev); cv.renderAll();
    }
    if (t==="calib"&&cbRef.current.state===1&&cbRef.current.pt) {
      if (cbRef.current.prev) cv.remove(cbRef.current.prev);
      cbRef.current.prev = mkL(cbRef.current.pt,sn,"#fbbf24",1.5,[6,4]);
      cv.add(cbRef.current.prev); cv.renderAll();
    }
    if (t==="measure"&&msRef.current.state===1&&msRef.current.pt) {
      if (msRef.current.prev) cv.remove(msRef.current.prev);
      msRef.current.prev = mkL(msRef.current.pt,sn,"#2dd4bf",1.5,[5,5]);
      cv.add(msRef.current.prev);
      const d = dst(msRef.current.pt,sn);
      const mm = pxMmRef.current ? px2mm(d) : null;
      setMpopText(mm ? `📏 ${fmm(mm)}  (${Math.round(d)}px)` : `📏 ${Math.round(d)}px`);
      setMpopVis(true);
      cv.renderAll();
    }
  }

  function onMU(e:any) {
    const cv = cvRef.current; if(!cv) return;
    if (toolRef.current==="wall"&&wallRef.current.draw&&wallRef.current.pt) {
      const pt = cv.getPointer(e.e);
      const sn = snapRef.current ? snp(pt) : pt;
      if (wallRef.current.prev) cv.remove(wallRef.current.prev);
      if (dst(wallRef.current.pt,sn)>5) {
        const fabric = (window as any).fabric;
        cv.add(new fabric.Line([wallRef.current.pt.x,wallRef.current.pt.y,sn.x,sn.y],
          {stroke:"#e2e8f0",strokeWidth:6,selectable:true,_t:"wall"}));
        saveH();
      }
      wallRef.current = {draw:false,pt:null,prev:null};
    }
  }

  function onMW(e:any) {
    const cv = cvRef.current; if(!cv) return;
    let z = cv.getZoom(); z *= e.e.deltaY>0 ? .9 : 1.1;
    z = Math.min(Math.max(z,.05),8);
    cv.zoomToPoint({x:e.e.offsetX,y:e.e.offsetY},z);
    setZoomState(z);
    e.e.preventDefault();
  }

  // ── Calibration ───────────────────────────────────────────────
  function mkTicks(p1:any,p2:any,col:string) {
    const fabric = (window as any).fabric;
    const dx=p2.x-p1.x,dy=p2.y-p1.y,l=Math.sqrt(dx*dx+dy*dy); if(l<1)return[];
    const nx=-dy/l*6,ny=dx/l*6;
    return [
      new fabric.Line([p1.x+nx,p1.y+ny,p1.x-nx,p1.y-ny],{stroke:col,strokeWidth:1.5,selectable:false,evented:false,_t:"calib"}),
      new fabric.Line([p2.x+nx,p2.y+ny,p2.x-nx,p2.y-ny],{stroke:col,strokeWidth:1.5,selectable:false,evented:false,_t:"calib"}),
    ];
  }

  function hCalib(pt:any) {
    const cv = cvRef.current; if(!cv) return;
    if (cbRef.current.state===0) {
      cbRef.current.state=1; cbRef.current.pt=pt;
      setHint("📐 2번째 점을 클릭하세요");
    } else {
      const fabric = (window as any).fabric;
      if (cbRef.current.prev) cv.remove(cbRef.current.prev);
      const d = dst(cbRef.current.pt,pt);
      const line = new fabric.Line([cbRef.current.pt.x,cbRef.current.pt.y,pt.x,pt.y],
        {stroke:"#fbbf24",strokeWidth:2,strokeDashArray:[8,4],selectable:false,evented:false,_t:"calib"});
      const lbl = new fabric.Text(`${Math.round(d)}px`,
        {left:(cbRef.current.pt.x+pt.x)/2,top:(cbRef.current.pt.y+pt.y)/2-14,
         fontSize:10,fill:"#fbbf24",fontFamily:"monospace",selectable:false,evented:false,_t:"calib"});
      const tks = mkTicks(cbRef.current.pt,pt,"#fbbf24");
      cbRef.current.lines=[line,lbl,...tks];
      cbRef.current.lines.forEach((o:any)=>cv.add(o));
      cv.renderAll();
      calibTmpRef.current = {px:d,mm:null};
      setCdPxVal(Math.round(d));
      setCdMm(1000);
      setShowCD(true);
      cbRef.current = {state:0,pt:null,prev:null,lines:cbRef.current.lines,tmp:null};
      setTool("select");
    }
  }

  function confirmCD() {
    if (!cdMm||cdMm<=0||!calibTmpRef.current) return;
    const newPxMm = calibTmpRef.current.px / cdMm;
    pxMmRef.current = newPxMm;
    setPxMm(newPxMm);
    setScaleLabel(`캘리브레이션  1mm=${newPxMm.toFixed(3)}px`);
    setShowCD(false);
  }

  function applyPreset() {
    const newPxMm = rscale*72/25.4/selPreset;
    pxMmRef.current = newPxMm;
    setPxMm(newPxMm);
    setScaleLabel(`1:${selPreset}  1mm=${newPxMm.toFixed(3)}px`);
    setShowSM(false);
  }

  function cleanCB() {
    const cv = cvRef.current;
    cbRef.current.state=0; cbRef.current.pt=null;
    if (cbRef.current.prev&&cv) { cv.remove(cbRef.current.prev); cbRef.current.prev=null; }
    if (cv) cv.renderAll();
  }

  // ── Measure ───────────────────────────────────────────────────
  function mkMTicks(p1:any,p2:any) {
    const fabric=(window as any).fabric;
    const dx=p2.x-p1.x,dy=p2.y-p1.y,l=Math.sqrt(dx*dx+dy*dy); if(l<1)return[];
    const nx=-dy/l*6,ny=dx/l*6;
    return [
      new fabric.Line([p1.x+nx,p1.y+ny,p1.x-nx,p1.y-ny],{stroke:"#2dd4bf",strokeWidth:1.5,selectable:false,evented:false,_t:"mline"}),
      new fabric.Line([p2.x+nx,p2.y+ny,p2.x-nx,p2.y-ny],{stroke:"#2dd4bf",strokeWidth:1.5,selectable:false,evented:false,_t:"mline"}),
    ];
  }

  function hMeas(pt:any) {
    const cv=cvRef.current; if(!cv) return;
    const fabric=(window as any).fabric;
    if (msRef.current.state===0) {
      msRef.current.state=1; msRef.current.pt=pt;
      setHint("📏 끝점을 클릭하세요 | Esc 취소");
    } else {
      if (msRef.current.prev) { cv.remove(msRef.current.prev); msRef.current.prev=null; }
      const d=dst(msRef.current.pt,pt), mm=pxMmRef.current?px2mm(d):null;
      if (mlVisRef.current) {
        const line=new fabric.Line([msRef.current.pt.x,msRef.current.pt.y,pt.x,pt.y],
          {stroke:"#2dd4bf",strokeWidth:1.5,strokeDashArray:[6,3],selectable:true,_t:"mline",_px:d,_mm:mm});
        const lbl=fmm(mm);
        const mid={x:(msRef.current.pt.x+pt.x)/2,y:(msRef.current.pt.y+pt.y)/2};
        const ang=Math.atan2(pt.y-msRef.current.pt.y,pt.x-msRef.current.pt.x)*180/Math.PI;
        const bg=new fabric.Rect({width:lbl.length*7+12,height:17,fill:"rgba(9,12,18,.9)",rx:3,ry:3,originX:"center",originY:"center",selectable:false,evented:false,_t:"mline"});
        const tx=new fabric.Text(lbl,{fontSize:11,fill:"#2dd4bf",fontFamily:"monospace",originX:"center",originY:"center",selectable:false,evented:false,_t:"mline"});
        const grp=new fabric.Group([bg,tx],{left:mid.x,top:mid.y-14,angle:Math.abs(ang)>90?ang+180:ang,selectable:false,evented:false,_t:"mline"});
        const tks=mkMTicks(msRef.current.pt,pt);
        cv.add(line); tks.forEach((t:any)=>cv.add(t)); cv.add(grp); cv.renderAll();
      }
      const newLog=[{px:Math.round(d),mm:mm?Math.round(mm):null},...mlogRef.current].slice(0,8);
      mlogRef.current=newLog; setMlog([...newLog]);
      setMpopText(mm?`📏 ${fmm(mm)}  (${Math.round(d)}px)`:`📏 ${Math.round(d)}px`);
      setMpopVis(true);
      setTimeout(()=>setMpopVis(false),3500);
      msRef.current={state:0,pt:null,prev:null};
      setHint("📏 시작점 클릭 → 끝점 클릭 | Esc 취소");
    }
  }

  function cleanMS() {
    const cv=cvRef.current;
    msRef.current={state:0,pt:null,prev:null};
    setMpopVis(false);
    if(cv)cv.renderAll();
  }

  // ── Seat / Text ───────────────────────────────────────────────
  function getSzPx() {
    const dw=600,dh=400,cd=400;
    if (pxMmRef.current) {
      const p=pxMmRef.current;
      return{DW:dw*p,DH:dh*p,CH:cd*p,GAP:20*p,dw,dh};
    }
    const s=stTypeRef.current==="study";
    return{DW:s?36:44,DH:s?24:20,CH:7,GAP:3,dw,dh};
  }

  function placeSeat(x:number,y:number) {
    const cv=cvRef.current; if(!cv) return;
    const fabric=(window as any).fabric;
    const{DW,DH,CH,GAP,dw,dh}=getSzPx();
    const col=stTypeRef.current==="study"?"#4f8ef7":"#a78bfa";
    const desk=new fabric.Rect({width:DW,height:DH,fill:col+"22",stroke:col,strokeWidth:1.5,rx:2,ry:2});
    const chair=new fabric.Rect({width:DW*.65,height:CH,fill:col+"44",stroke:col,strokeWidth:1,rx:1,ry:1,top:DH+GAP,left:DW*.175});
    const s=new fabric.Group([desk,chair],{left:x-DW/2,top:y-DH/2,_t:"seat",_st:stTypeRef.current,_lb:"",_dw:dw,_dh:dh,hasControls:true,lockScalingX:true,lockScalingY:true});
    s.setControlsVisibility({mt:false,mb:false,ml:false,mr:false,tl:false,tr:false,bl:false,br:false,mtr:true});
    cv.add(s); cv.setActiveObject(s); cv.renderAll();
  }

  function placeTxt(x:number,y:number) {
    const cv=cvRef.current; if(!cv) return;
    const fabric=(window as any).fabric;
    const t=new fabric.IText("텍스트",{left:x,top:y,fontSize:13,fill:"#fbbf24",fontFamily:"sans-serif",_t:"label",_lb:"",editable:true});
    cv.add(t); cv.setActiveObject(t); t.enterEditing(); t.selectAll(); cv.renderAll(); saveH(); setTool("select");
  }

  // ── Selection props ───────────────────────────────────────────
  function onSel() {
    const cv=cvRef.current; if(!cv) return;
    const objs=cv.getActiveObjects();
    if(!objs.length)return;
    const f=objs[0];
    setSelProps({count:objs.length,obj:f});
  }

  // ── History ───────────────────────────────────────────────────
  function saveH() {
    const cv=cvRef.current; if(!cv) return;
    const j=JSON.stringify(cv.toJSON(PKEYS));
    const hist=histRef.current, idx=hIdxRef.current;
    const newHist=idx<hist.length-1?[...hist.slice(0,idx+1),j]:[...hist,j];
    if(newHist.length>HMAX)newHist.shift();
    histRef.current=newHist; hIdxRef.current=newHist.length-1;
    setUndoOk(newHist.length>1); setRedoOk(false);
  }

  function undo() {
    const cv=cvRef.current; if(!cv||hIdxRef.current<=0) return;
    hIdxRef.current--;
    cv.loadFromJSON(JSON.parse(histRef.current[hIdxRef.current]),()=>{cv.renderAll();updCnt();});
    setUndoOk(hIdxRef.current>0); setRedoOk(true);
  }

  function redo() {
    const cv=cvRef.current; if(!cv||hIdxRef.current>=histRef.current.length-1) return;
    hIdxRef.current++;
    cv.loadFromJSON(JSON.parse(histRef.current[hIdxRef.current]),()=>{cv.renderAll();updCnt();});
    setRedoOk(hIdxRef.current<histRef.current.length-1); setUndoOk(true);
  }

  // ── Counter / Room stats ──────────────────────────────────────
  function updCnt() {
    const cv=cvRef.current; if(!cv) return;
    const seats=cv.getObjects().filter((o:any)=>o._t==="seat");
    setSeatCount(seats.length);
    const rm:Record<string,number>={};
    seats.forEach((s:any)=>{const k=s._lb||"(레이블 없음)";rm[k]=(rm[k]||0)+1;});
    setRoomStats(rm);
  }

  // ── Edit ops ──────────────────────────────────────────────────
  function delSel() {
    const cv=cvRef.current; if(!cv) return;
    cv.getActiveObjects().forEach((o:any)=>cv.remove(o));
    cv.discardActiveObject(); cv.renderAll(); saveH();
  }
  function dupSel() {
    const cv=cvRef.current; if(!cv) return;
    const objs=cv.getActiveObjects(); if(!objs.length) return;
    cv.discardActiveObject(); let done=0; const neu:any[]=[];
    objs.forEach((o:any)=>o.clone((c2:any)=>{
      c2.set({left:o.left+24,top:o.top+24});
      PKEYS.forEach(k=>{if(o[k]!==undefined)c2[k]=o[k];});
      cv.add(c2); neu.push(c2);
      if(++done===objs.length){
        const fabric=(window as any).fabric;
        cv.setActiveObject(new fabric.ActiveSelection(neu,{canvas:cv}));
        cv.renderAll(); saveH();
      }
    }));
  }
  function clrAll() {
    const cv=cvRef.current; if(!cv) return;
    if(!confirm("편집 레이어를 모두 지울까요?")) return;
    cv.getObjects().filter((o:any)=>!o._bg&&!o._gr).forEach((o:any)=>cv.remove(o));
    cv.renderAll(); saveH();
  }
  function togMLines() {
    const cv=cvRef.current; if(!cv) return;
    mlVisRef.current=!mlVisRef.current; setMlVis(mlVisRef.current);
    cv.getObjects().forEach((o:any)=>{if(o._t==="mline")o.set("visible",mlVisRef.current);});
    cv.renderAll();
  }
  function clrMLines() {
    const cv=cvRef.current; if(!cv) return;
    cv.getObjects().filter((o:any)=>o._t==="mline"||o._t==="calib").forEach((o:any)=>cv.remove(o));
    mlogRef.current=[]; setMlog([]); cv.renderAll();
  }

  // ── Zoom ──────────────────────────────────────────────────────
  function zIn()  { const cv=cvRef.current;if(!cv)return;const z=Math.min(cv.getZoom()*1.2,8);cv.setZoom(z);setZoomState(z); }
  function zOut() { const cv=cvRef.current;if(!cv)return;const z=Math.max(cv.getZoom()*.8,.05);cv.setZoom(z);setZoomState(z); }
  function fit()  {
    const cv=cvRef.current; if(!cv||!pdfWRef.current) return;
    const s=Math.min((cv.width-40)/pdfWRef.current,(cv.height-40)/pdfHRef.current,1);
    cv.setViewportTransform([s,0,0,s,20,20]); setZoomState(s);
  }

  // ── Save to Supabase ──────────────────────────────────────────
  async function saveLayout() {
    const cv=cvRef.current; if(!cv||!selectedOrg) return;
    setSaveStatus("saving");
    try {
      const layout_json=cv.toJSON(PKEYS);
      const res=await fetch("/api/floor",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({org_id:selectedOrg,layout_json})});
      if(!res.ok) throw new Error();
      setSaveStatus("saved");
      setTimeout(()=>setSaveStatus("idle"),2000);
    } catch {
      setSaveStatus("error");
      setTimeout(()=>setSaveStatus("idle"),3000);
    }
  }

  // ── Export ────────────────────────────────────────────────────
  function expPNG() {
    const cv=cvRef.current; if(!cv) return;
    cv.discardActiveObject(); cv.renderAll();
    const a=document.createElement("a");
    a.href=cv.toDataURL({format:"png",quality:1,multiplier:2});
    a.download=(fnameRef.current||"flooredit")+"_배치안.png"; a.click();
  }
  function expPDF() {
    const cv=cvRef.current; if(!cv) return;
    cv.discardActiveObject(); cv.renderAll();
    const url=cv.toDataURL({format:"png",quality:1,multiplier:2});
    const img=new Image();
    img.onload=()=>{
      const go=()=>{
        const{jsPDF}=(window as any).jspdf;
        const doc=new jsPDF({orientation:img.width>img.height?"landscape":"portrait",unit:"px",format:[img.width,img.height]});
        doc.addImage(url,"PNG",0,0,img.width,img.height);
        doc.save((fnameRef.current||"flooredit")+"_배치안.pdf");
      };
      if(!(window as any).jspdf){
        const s=document.createElement("script");
        s.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
        s.onload=go; document.body.appendChild(s);
      } else go();
    };
    img.src=url;
  }

  // ── Keyboard ──────────────────────────────────────────────────
  function onKey(e:KeyboardEvent) {
    const tag=(e.target as HTMLElement)?.tagName;
    if(["INPUT","TEXTAREA","SELECT"].includes(tag||"")) return;
    if(e.key==="Escape"){cleanMS();cleanCB();wallRef.current={draw:false,pt:null,prev:null};setTool("select");}
    const cv=cvRef.current; if(!cv) return;
    if((e.key==="Delete"||e.key==="Backspace")&&cv.getActiveObjects().length) delSel();
    if(e.ctrlKey&&e.key==="z"){e.preventDefault();undo();}
    if(e.ctrlKey&&(e.key==="y"||e.key==="Y")){e.preventDefault();redo();}
    if(e.ctrlKey&&e.key==="d"){e.preventDefault();dupSel();}
    const ks:Record<string,Tool>={v:"select",V:"select",s:"seat",S:"seat",t:"text",T:"text",w:"wall",W:"wall",c:"calib",C:"calib",m:"measure",M:"measure"};
    if(!e.ctrlKey&&ks[e.key]) setTool(ks[e.key]);
    if(!e.ctrlKey&&(e.key==="f"||e.key==="F")) fit();
  }

  // ── Style helpers ─────────────────────────────────────────────
  const btn = (active=false): React.CSSProperties => ({
    height:28, padding:"0 10px", borderRadius:5,
    border: active ? `1px solid ${T.yellow}` : `1px solid ${T.border}`,
    background: active ? `rgba(245,196,24,0.15)` : T.bgCard,
    color: active ? T.yellow : T.textPri,
    fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", gap:4,
    fontFamily:"inherit", whiteSpace:"nowrap" as const, flexShrink:0,
    transition:"all .15s",
  });

  const tbtn = (t:Tool): React.CSSProperties => ({
    height:46, borderRadius:5, border:`1px solid ${tool===t?T.yellow:T.border}`,
    background: tool===t ? `rgba(245,196,24,0.12)` : T.bgCard,
    color: tool===t ? T.yellow : T.textMuted,
    fontSize:9, cursor:"pointer", display:"flex", flexDirection:"column" as const,
    alignItems:"center", justifyContent:"center", gap:2, transition:"all .15s",
  });

  const panelStyle: React.CSSProperties = {
    width:200, flexShrink:0, background:T.bgSurface, borderRight:`1px solid ${T.border}`,
    display:"flex", flexDirection:"column", overflowY:"auto",
  };
  const secStyle: React.CSSProperties = {
    padding:10, borderBottom:`1px solid ${T.border}`,
  };
  const secTStyle: React.CSSProperties = {
    fontSize:9, fontWeight:600, letterSpacing:".12em", textTransform:"uppercase" as const,
    color:T.textMuted, marginBottom:8,
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:T.bgBase, color:T.textPri, fontFamily:"'Pretendard','Noto Sans KR',sans-serif", minHeight:0 }}>

      {/* ── TOP BAR ── */}
      <div style={{ height:44, background:T.bgSurface, borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", padding:"0 10px", gap:6, flexShrink:0 }}>

        {/* 학원 선택 */}
        <select
          value={selectedOrg}
          onChange={e=>setSelectedOrg(Number(e.target.value))}
          style={{ height:28, background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:5, color:T.textPri, fontSize:11, padding:"0 8px", cursor:"pointer" }}
        >
          <option value={0}>학원 선택</option>
          {ORG_LIST.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
        </select>

        <div style={{width:1,height:22,background:T.border}}/>

        {/* 편집 도구 */}
        <button style={btn(false)} disabled={!undoOk} onClick={undo} title="Ctrl+Z">↩ 실행취소</button>
        <button style={btn(false)} disabled={!redoOk} onClick={redo} title="Ctrl+Y">↪ 다시실행</button>
        <div style={{width:1,height:22,background:T.border}}/>
        <button style={btn(false)} onClick={zIn}>＋</button>
        <button style={btn(false)} onClick={zOut}>－</button>
        <button style={btn(false)} onClick={fit} title="F키">⊡ 맞춤</button>

        <div style={{flex:1}}/>

        {/* 스케일 배지 */}
        <button
          onClick={()=>setShowSM(true)}
          style={{ height:28, padding:"0 11px", borderRadius:5, border:`1px solid ${pxMm?"rgba(52,211,153,.4)":"rgba(251,191,36,.3)"}`, background:pxMm?"rgba(52,211,153,.08)":"rgba(251,191,36,.08)", color:pxMm?"#34d399":"#fbbf24", fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap" }}
        >
          📏 {scaleLabel}
        </button>

        <div style={{width:1,height:22,background:T.border}}/>

        {/* 좌석 수 */}
        <div style={{ height:28, padding:"0 10px", borderRadius:5, border:"1px solid rgba(52,211,153,.25)", background:"rgba(52,211,153,.08)", color:"#34d399", fontSize:12, display:"flex", alignItems:"center", gap:5 }}>
          🪑 {seatCount}석
        </div>

        <div style={{width:1,height:22,background:T.border}}/>

        {/* 저장 / 내보내기 */}
        <button
          style={btn(false,"pri")}
          onClick={saveLayout}
          disabled={!selectedOrg||pdfStatus!=="loaded"}
        >
          {saveStatus==="saving"?"저장 중...":saveStatus==="saved"?"✓ 저장됨":saveStatus==="error"?"⚠ 오류":"💾 저장"}
        </button>
        <button style={btn(false)} onClick={expPNG} disabled={pdfStatus!=="loaded"}>🖼 PNG</button>
        <button style={btn(false)} onClick={expPDF} disabled={pdfStatus!=="loaded"}>📄 PDF</button>
      </div>

      {/* ── MAIN ── */}
      <div style={{ display:"flex", flex:1, overflow:"hidden", minHeight:0 }}>

        {/* ── LEFT PANEL ── */}
        <div style={panelStyle}>

          {/* 도구 */}
          <div style={secStyle}>
            <div style={secTStyle}>도구  <span style={{fontSize:8,fontWeight:400,textTransform:"none",letterSpacing:0}}>V S T W C M</span></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:3}}>
              {([["select","↖","선택(V)"],["seat","🪑","좌석(S)"],["text","T","텍스트"],["wall","▐","벽체(W)"],["calib","📐","축척보정(C)"],["measure","📏","측정자(M)"]] as [Tool,string,string][]).map(([t,ic,lbl])=>(
                <button key={t} style={tbtn(t)} onClick={()=>setTool(t)}>
                  <span style={{fontSize:15,lineHeight:1}}>{ic}</span>
                  <span>{lbl}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 좌석 타입 */}
          <div style={secStyle}>
            <div style={secTStyle}>좌석 타입</div>
            <div style={{display:"flex",gap:4}}>
              <button onClick={()=>selSt("study")} style={{...btn(stType==="study"),flex:1,justifyContent:"center"}}>자습형</button>
              <button onClick={()=>selSt("lecture")} style={{...btn(stType==="lecture"),flex:1,justifyContent:"center"}}>강의형</button>
            </div>
          </div>

          {/* 페이지 목록 */}
          {totPages>1&&(
            <div style={secStyle}>
              <div style={secTStyle}>페이지</div>
              {Array.from({length:totPages},(_,i)=>(
                <button key={i+1} onClick={()=>renderPage(i+1)} style={{
                  width:"100%",padding:"5px 8px",borderRadius:4,marginBottom:2,
                  border:`1px solid ${curPage===i+1?T.yellow:"transparent"}`,
                  background:curPage===i+1?`rgba(245,196,24,0.1)`:"transparent",
                  color:curPage===i+1?T.yellow:T.textMuted,fontSize:10,cursor:"pointer",textAlign:"left",fontFamily:"inherit",
                }}>
                  {i+1}. {PGLBL[i+1]||`Page ${i+1}`}
                </button>
              ))}
            </div>
          )}

          {/* 편집 */}
          <div style={secStyle}>
            <div style={secTStyle}>편집</div>
            <div style={{display:"flex",flexDirection:"column",gap:3}}>
              <button style={{...btn(),justifyContent:"center"}} onClick={dupSel}>⧉ 복제 (Ctrl+D)</button>
              <button style={{...btn(),justifyContent:"center",color:"#ef4444",borderColor:"rgba(239,68,68,.3)"}} onClick={delSel}>✕ 삭제 (Del)</button>
              <button style={{...btn(),justifyContent:"center"}} onClick={clrAll}>🗑 전체 편집 삭제</button>
            </div>
          </div>

          {/* 측정 로그 */}
          <div style={secStyle}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
              <span style={secTStyle}>측정 기록</span>
              <div style={{display:"flex",gap:4}}>
                <button style={{...btn(mlVis),fontSize:9,padding:"0 6px",height:20}} onClick={togMLines}>{mlVis?"숨기기":"보이기"}</button>
                <button style={{...btn(),fontSize:9,padding:"0 6px",height:20}} onClick={clrMLines}>삭제</button>
              </div>
            </div>
            {mlog.length===0
              ? <div style={{fontSize:10,color:T.textHint}}>측정 결과 없음</div>
              : mlog.map((m,i)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:`1px solid ${T.gridLine}`,fontSize:10}}>
                  <span style={{color:T.textMuted}}>#{i+1}</span>
                  <span style={{color:"#2dd4bf",fontFamily:"monospace"}}>{m.mm!=null?fmm(m.mm):m.px+"px"}</span>
                </div>
              ))
            }
          </div>
        </div>

        {/* ── CANVAS AREA ── */}
        <div ref={wrapRef} style={{ flex:1, overflow:"hidden", position:"relative", background:theme==="dark"?"#090c12":"#e8e8e8", minWidth:0 }}>

          {/* 도면 없음 / 로딩 오버레이 */}
          {(pdfStatus==="none"||pdfStatus==="missing")&&(
            <div style={{ position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:theme==="dark"?"rgba(15,17,23,.97)":"rgba(240,240,240,.97)",zIndex:50 }}>
              <div style={{fontSize:40,marginBottom:16,opacity:.4}}>🏫</div>
              <div style={{fontSize:16,fontWeight:500,marginBottom:6,color:T.textPri}}>
                {pdfStatus==="missing"?"도면 파일을 찾을 수 없습니다":"상단에서 학원을 선택하세요"}
              </div>
              <div style={{fontSize:12,color:T.textMuted}}>
                {pdfStatus==="missing"?`Supabase Storage > floor-plans 버킷에 PDF를 업로드해주세요`:"학원을 선택하면 도면이 자동으로 열립니다"}
              </div>
            </div>
          )}

          {pdfStatus==="loading"&&(
            <div style={{ position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"rgba(15,17,23,.9)",zIndex:60 }}>
              <div style={{width:32,height:32,border:`2px solid ${T.border}`,borderTopColor:"#4f8ef7",borderRadius:"50%",animation:"spin .7s linear infinite",marginBottom:12}}/>
              <div style={{fontSize:12,color:T.textMuted}}>도면 로딩 중...</div>
            </div>
          )}

          {/* canvas는 useEffect에서 직접 생성 — React JSX에 두면 리렌더링 시 충돌 */}
          <div id="flooredit-cc" style={{position:"absolute",top:0,left:0,width:"100%",height:"100%"}} />

          {/* 줌 인디케이터 */}
          <div style={{ position:"absolute",bottom:12,left:"50%",transform:"translateX(-50%)",background:T.bgSurface,border:`1px solid ${T.border}`,borderRadius:5,padding:"4px 10px",fontFamily:"monospace",fontSize:11,color:T.textMuted,pointerEvents:"none" }}>
            {Math.round(zoom*100)}%
          </div>

          {/* 힌트 */}
          {hint&&(
            <div style={{ position:"absolute",bottom:42,left:"50%",transform:"translateX(-50%)",background:"rgba(15,17,23,.92)",border:`1px solid ${T.border}`,borderRadius:4,padding:"5px 14px",fontSize:11,color:T.textMuted,pointerEvents:"none",whiteSpace:"nowrap" }}>
              {hint}
            </div>
          )}

          {/* 측정 팝업 */}
          {mpopVis&&(
            <div style={{ position:"absolute",top:58,left:"50%",transform:"translateX(-50%)",background:T.bgSurface,border:"1px solid #2dd4bf",borderRadius:6,padding:"7px 18px",fontFamily:"monospace",fontSize:13,color:"#2dd4bf",pointerEvents:"none",whiteSpace:"nowrap",boxShadow:"0 4px 20px rgba(45,212,191,.2)" }}>
              {mpopText}
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{width:190,flexShrink:0,background:T.bgSurface,borderLeft:`1px solid ${T.border}`,display:"flex",flexDirection:"column",overflowY:"auto"}}>

          {/* 좌석 집계 */}
          <div style={secStyle}>
            <div style={secTStyle}>좌석 집계</div>
            {Object.keys(roomStats).length===0
              ? <div style={{fontSize:10,color:T.textHint}}>좌석 배치 후 표시됩니다</div>
              : <>
                  {Object.entries(roomStats).map(([k,n])=>(
                    <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:`1px solid ${T.gridLine}`,fontSize:10}}>
                      <span style={{color:T.textMuted}}>{k}</span>
                      <span style={{color:"#34d399",fontFamily:"monospace"}}>{n}석</span>
                    </div>
                  ))}
                  <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",fontWeight:600,fontSize:11}}>
                    <span style={{color:T.textPri}}>합계</span>
                    <span style={{color:"#34d399",fontFamily:"monospace"}}>{seatCount}석</span>
                  </div>
                </>
            }
          </div>

          {/* 선택 객체 속성 */}
          <div style={secStyle}>
            <div style={secTStyle}>속성</div>
            {!selProps
              ? <div style={{fontSize:10,color:T.textHint,lineHeight:1.8}}>객체를 선택하면<br/>속성이 표시됩니다</div>
              : selProps.count>1
                ? <div style={{fontSize:11,color:T.textPri}}>{selProps.count}개 선택됨</div>
                : (()=>{
                    const o=selProps.obj;
                    const tp=o._t||(o.type==="i-text"?"label":o.type);
                    const tl:Record<string,string>={seat:o._st==="study"?"자습형 좌석":"강의형 좌석",label:"텍스트",wall:"벽체",mline:"측정선"};
                    return (
                      <div style={{fontSize:11}}>
                        {[["유형",tl[tp]||tp],["X",Math.round(o.left)],["Y",Math.round(o.top)],["회전",`${Math.round(o.angle||0)}°`]].map(([l,v])=>(
                          <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:`1px solid ${T.gridLine}`}}>
                            <span style={{color:T.textMuted}}>{l}</span>
                            <span style={{color:T.textPri,fontFamily:"monospace"}}>{v}</span>
                          </div>
                        ))}
                        {(tp==="seat"||tp==="label")&&(
                          <div style={{marginTop:8}}>
                            <div style={{fontSize:9,color:T.textMuted,marginBottom:4}}>레이블 (방 이름)</div>
                            <input
                              defaultValue={o._lb||""}
                              placeholder="예: 자습실 A"
                              onChange={e=>{
                                const cv=cvRef.current; if(!cv) return;
                                const act=cv.getActiveObject(); if(!act) return;
                                act._lb=e.target.value; updCnt(); cv.renderAll();
                              }}
                              style={{width:"100%",height:26,background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:3,color:T.textPri,fontSize:11,padding:"0 6px",outline:"none",fontFamily:"inherit"}}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })()
            }
          </div>
        </div>
      </div>

      {/* ── 축척 설정 모달 ── */}
      {showSM&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:T.bgSurface,border:`1px solid ${T.borderEm}`,borderRadius:10,padding:24,width:420,boxShadow:"0 20px 60px rgba(0,0,0,.5)",maxHeight:"90vh",overflowY:"auto"}}>
            <div style={{fontSize:14,fontWeight:600,color:T.textPri,marginBottom:4}}>축척 설정</div>
            <div style={{fontSize:11,color:T.textMuted,marginBottom:16,lineHeight:1.7}}>도면의 축척을 설정하면 실측 크기로 좌석을 배치할 수 있습니다.</div>

            <div style={{fontSize:11,fontWeight:500,color:T.textPri,marginBottom:8}}>방법 A — 축척 직접 선택</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
              {PRE.map(p=>(
                <button key={p.v} onClick={()=>setSelPreset(p.v)}
                  style={{...btn(selPreset===p.v,"pri"),padding:"0 10px"}}>{p.l}</button>
              ))}
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,color:T.textMuted,marginBottom:4}}>PDF 렌더링 배율 (기본 1.5)</div>
              <input type="number" value={rscale} step={0.1} min={0.5} max={4}
                onChange={e=>setRscale(Number(e.target.value))}
                style={{width:"100%",height:34,background:T.bgCard,border:`1px solid ${T.borderEm}`,borderRadius:5,color:T.textPri,fontSize:13,padding:"0 10px",outline:"none",fontFamily:"monospace"}}/>
            </div>
            <div style={{background:`rgba(79,142,247,.05)`,border:"1px solid rgba(79,142,247,.2)",borderRadius:5,padding:10,marginBottom:12}}>
              <div style={{fontSize:10,color:T.textMuted,marginBottom:4}}>계산된 변환 비율</div>
              <div style={{color:"#4f8ef7",fontFamily:"monospace",fontSize:12}}>
                1mm = {(rscale*72/25.4/selPreset).toFixed(4)}px
              </div>
            </div>
            <button style={{...btn(false,"pri"),width:"100%",justifyContent:"center"}} onClick={applyPreset}>이 축척으로 적용</button>

            <div style={{marginTop:16,marginBottom:8,fontSize:11,fontWeight:500,color:T.textPri}}>방법 B — 캘리브레이션 <span style={{fontSize:9,color:"#2dd4bf"}}>(더 정확)</span></div>
            <div style={{fontSize:10,color:T.textMuted,marginBottom:8,lineHeight:1.6}}>도구에서 📐 축척보정(C)을 선택하고<br/>도면 위 두 점을 클릭한 뒤 실제 거리를 입력하세요.</div>

            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16}}>
              <button style={btn()} onClick={()=>setShowSM(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 캘리브레이션 입력 모달 ── */}
      {showCD&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.72)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:T.bgSurface,border:`1px solid ${T.borderEm}`,borderRadius:10,padding:24,width:320,boxShadow:"0 20px 60px rgba(0,0,0,.5)"}}>
            <div style={{fontSize:14,fontWeight:600,color:T.textPri,marginBottom:4}}>두 점 사이의 실제 거리 입력</div>
            <div style={{fontSize:11,color:T.textMuted,marginBottom:16}}>
              측정 픽셀 거리: <b style={{color:"#fbbf24"}}>{cdPxVal}px</b>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,color:T.textMuted,marginBottom:4}}>실제 거리 (mm)</div>
              <input type="number" value={cdMm} min={1}
                onChange={e=>setCdMm(Number(e.target.value))}
                style={{width:"100%",height:34,background:T.bgCard,border:`1px solid ${T.borderEm}`,borderRadius:5,color:T.textPri,fontSize:13,padding:"0 10px",outline:"none",fontFamily:"monospace"}}/>
            </div>
            {cdMm>0&&cdPxVal>0&&(
              <div style={{background:"rgba(79,142,247,.05)",border:"1px solid rgba(79,142,247,.2)",borderRadius:5,padding:10,marginBottom:12}}>
                <div style={{fontSize:10,color:T.textMuted,marginBottom:4}}>계산 결과 미리보기</div>
                <div style={{color:"#4f8ef7",fontFamily:"monospace",fontSize:12}}>
                  {cdPxVal}px ÷ {cdMm}mm → 1mm = {(cdPxVal/cdMm).toFixed(4)}px
                </div>
              </div>
            )}
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button style={btn()} onClick={()=>{setShowCD(false);const cv=cvRef.current;if(cv){cbRef.current.lines.forEach((o:any)=>cv.remove(o));cbRef.current.lines=[];cv.renderAll();}}}>취소</button>
              <button style={btn(false,"pri")} onClick={confirmCD}>적용 및 축척 설정</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  );
}