"use client";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import FilterBar, { FilterState } from "@/components/dashboard/FilterBar";
import NaverMap from "@/components/dashboard/NaverMap";
import { useTheme } from "@/lib/theme";
import {
  ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

const MENU = [
  {icon:"⊞", label:"대시보드"},
  {icon:"🏫",label:"학원 상세 분석", sub:[{icon:"📋",label:"월간 보고서"}]},
  {icon:"👥",label:"재원생 분석", sub:[
    {icon:"📊",label:"등록 추이(전체)"},
    {icon:"📈",label:"등록 추이(학원별)"},
    {icon:"🎯",label:"입결 현황"},
  ]},
  {icon:"🗺",label:"FloorEdit"},
  {icon:"📊",label:"단과 판매 분석"},
  {icon:"👨‍🏫",label:"개별 강사 현황"},
];

const CHART_CONFIGS_BASE = [
  { title:"매출",      accountId:1   },
  { title:"판관비",    accountId:128 },
  { title:"영업이익Ⅱ", accountId:285 },
];

// ── AI 코멘트 ─────────────────────────────────────────────────
function AiComment({ text }: { text:string }) {
  const { T } = useTheme();
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div style={{ background:T.bgCard, border:`1px solid rgba(245,196,24,0.2)`, borderRadius:12, padding:"20px 22px" }}>
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, color:T.yellow }}>AI 분석 코멘트</div>
        <div style={{ fontSize:10, color:T.textMuted }}>Claude Sonnet 4 분석</div>
      </div>
      <div style={{ fontSize:12, lineHeight:1.8, color:T.textPri }}>
        {lines.map((line,i) => {
          if (!line.trim()) return <div key={i} style={{ height:6 }} />;
          if (line.startsWith("**") && line.endsWith("**"))
            return <div key={i} style={{ fontSize:12, fontWeight:700, color:T.yellow, marginTop:10, marginBottom:3, paddingLeft:8, borderLeft:`2px solid ${T.yellow}` }}>{line.replace(/\*\*/g,"")}</div>;
          if (line.startsWith("- ") || line.startsWith("• "))
            return <div key={i} style={{ display:"flex", gap:6, marginBottom:3, paddingLeft:6 }}><span style={{ color:T.green, flexShrink:0 }}>•</span><span>{line.replace(/^[-•]\s/,"")}</span></div>;
          return <p key={i} style={{ margin:"0 0 4px", color:T.textMuted }}>{line}</p>;
        })}
      </div>
    </div>
  );
}

// ── 유틸 ─────────────────────────────────────────────────────
function yearLabel(year:number) { return year>=2026?`${year}년(E)`:`${year}년`; }
function fmt(v:number|null,unit="억원") { if(v==null)return"—";return`${v<0?"-":""}${Math.abs(v).toLocaleString("ko-KR")}${unit}`; }
function fmtPct(v:number|null,suffix="%") { if(v==null)return"—";const abs=Math.abs(v);return`${v<0?"-":""}${abs>=1000?abs.toLocaleString("ko-KR",{maximumFractionDigits:1}):abs.toFixed(1)}${suffix}`; }

function Pill({ value, suffix="%", maxDisplay }: { value:number|null; suffix?:string; maxDisplay?:number }) {
  const { T } = useTheme();
  if (value==null) return <span style={{ color:T.textMuted }}>—</span>;
  if (maxDisplay!=null&&Math.abs(value)>maxDisplay) return <span style={{ color:T.textMuted }}>—</span>;
  const pos=value>=0, abs=Math.abs(value);
  return <span style={{ color:pos?T.up:T.dn, fontWeight:600, fontSize:12 }}>{pos?"▲":"▼"} {abs>=1000?abs.toLocaleString("ko-KR",{maximumFractionDigits:1}):abs.toFixed(1)}{suffix}</span>;
}

function ProgressBar({ value, color }: { value:number|null; color:string }) {
  const { T } = useTheme();
  if (value==null) return null;
  const isOver=value>=100, displayVal=Math.min(Math.max(value,0),100);
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ height:5, background:T.gridLine, borderRadius:20, overflow:"hidden" }}>
        <div style={{ width:`${displayVal}%`, height:"100%", background:isOver?color:T.dn, borderRadius:20, transition:"width 0.8s ease" }} />
      </div>
      <div style={{ display:"flex", justifyContent:"flex-end", marginTop:3 }}>
        <span style={{ fontSize:10, fontWeight:700, color:isOver?color:T.dn }}>{value.toFixed(1)}%</span>
      </div>
    </div>
  );
}

// ── 툴팁 ─────────────────────────────────────────────────────
function MonthlyTooltipInner({ active, payload, label, year, T }: any) {
  if (!active||!payload?.length) return null;
  const currItem=payload.find((p:any)=>p.dataKey==="현재연도");
  const prevItem=payload.find((p:any)=>p.dataKey==="전년도");
  const currVal=currItem?.value??null, prevVal=prevItem?.value??null;
  const yoy=currVal!=null&&prevVal!=null&&prevVal!==0?((currVal-prevVal)/Math.abs(prevVal)*100):null;
  return (
    <div style={{ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:8, padding:"10px 14px", fontSize:11, minWidth:160 }}>
      <p style={{ color:T.yellow, marginBottom:8, fontWeight:700 }}>{label}</p>
      {currItem&&<div style={{ display:"flex", justifyContent:"space-between", gap:16, marginBottom:4 }}>
        <span style={{ color:currItem.color, fontWeight:600 }}>{yearLabel(year)}</span>
        <span style={{ color:T.textPri }}>{currVal?.toLocaleString("ko-KR")}백만</span>
      </div>}
      {prevItem&&<div style={{ display:"flex", justifyContent:"space-between", gap:16, marginBottom:6 }}>
        <span style={{ color:T.textMuted }}>{year-1}년</span>
        <span style={{ color:T.textMuted }}>{prevVal?.toLocaleString("ko-KR")}백만</span>
      </div>}
      {yoy!=null&&<div style={{ borderTop:`1px solid ${T.border}`, paddingTop:6, display:"flex", justifyContent:"space-between" }}>
        <span style={{ color:T.textHint, fontSize:10 }}>전년대비</span>
        <span style={{ fontWeight:700, color:yoy>=0?T.up:T.dn }}>{yoy>=0?"▲":"▼"} {Math.abs(yoy).toFixed(1)}%</span>
      </div>}
    </div>
  );
}

// ── 월별 차트 ────────────────────────────────────────────────
function MonthlyChart({ data, year, color, height=160 }: { data:any[]; year:number; color:string; height?:number }) {
  const { T } = useTheme();
  const allVals=data.flatMap(d=>[d.현재연도,d.전년도]).filter(v=>v!=null) as number[];
  if (!allVals.length) return <div style={{ height:120, display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:11, color:T.textMuted }}>데이터 없음</span></div>;
  const minVal=Math.min(...allVals), maxVal=Math.max(...allVals);
  const padding=(maxVal-minVal)*0.2||500;
  const yMin=minVal<0?Math.floor((minVal-padding)/500)*500:0;
  const yMax=Math.ceil((maxVal+padding)/500)*500;
  const TooltipWrapper = (props: any) => <MonthlyTooltipInner {...props} year={year} T={T} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top:6, right:20, left:0, bottom:0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={T.gridLine} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize:9, fill:T.textMuted }} axisLine={false} tickLine={false} />
        <YAxis domain={[yMin,yMax]} tick={{ fontSize:9, fill:T.textMuted }} axisLine={false} tickLine={false} width={40}
          tickFormatter={v=>Math.abs(v)>=10000?`${(v/10000).toFixed(0)}만`:v.toLocaleString("ko-KR")} />
        <Tooltip content={<TooltipWrapper />} cursor={{ stroke:"rgba(255,255,255,0.06)", strokeWidth:1 }} />
        <Area type="monotone" dataKey="전년도" stroke="rgba(180,180,180,0.7)" strokeWidth={2} fill="rgba(150,150,150,0.15)" fillOpacity={1} dot={false} activeDot={{ r:3, fill:"#aaa", strokeWidth:0 }} />
        <Line type="monotone" dataKey="현재연도" stroke={color} strokeWidth={2} dot={{ r:2.5, fill:color, strokeWidth:0 }} activeDot={{ r:4, fill:color, strokeWidth:0 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── 도넛 차트 ────────────────────────────────────────────────
interface DonutConfig { id:string; title:string; total:number|null; items:{label:string;value:number;color:string}[]; }

function DonutChart({ config }: { config:DonutConfig }) {
  const { T } = useTheme();
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const chartRef=useRef<any>(null);
  useEffect(()=>{
    if (!canvasRef.current||!config.items.length) return;
    const initChart=()=>{
      const ChartJS=(window as any).Chart;
      if (!ChartJS) return;
      if (chartRef.current) chartRef.current.destroy();
      const total=config.items.reduce((s,i)=>s+i.value,0);
      const centerPlugin={id:"centerText",afterDraw(chart:any){
        const {ctx,chartArea:{left,right,top,bottom}}=chart;
        const cx=(left+right)/2, cy=(top+bottom)/2;
        ctx.save();
        ctx.font="10px SUIT,sans-serif"; ctx.fillStyle=T.textMuted; ctx.textAlign="center";
        ctx.fillText("합계",cx,cy-9);
        const totalEok=config.total!=null?`${config.total.toLocaleString("ko-KR")}억`:`${Math.round(total).toLocaleString("ko-KR")}억`;
        ctx.font="bold 14px SUIT,sans-serif"; ctx.fillStyle=T.textPri;
        ctx.fillText(totalEok,cx,cy+7); ctx.restore();
      }};
      chartRef.current=new ChartJS(canvasRef.current,{
        type:"doughnut",
        data:{labels:config.items.map(i=>i.label),datasets:[{data:config.items.map(i=>i.value),backgroundColor:config.items.map(i=>i.color),borderWidth:0,hoverOffset:4}]},
        options:{responsive:true,maintainAspectRatio:false,cutout:"68%",plugins:{legend:{display:false},tooltip:{backgroundColor:T.bgCard,titleColor:T.yellow,bodyColor:T.textMuted,borderColor:T.border,borderWidth:1,padding:8,callbacks:{title:()=>"",label:(ctx:any)=>` ${ctx.label}  ${ctx.parsed.toFixed(1)}억`}}}},
        plugins:[centerPlugin],
      });
      chartRef.current.update("none");
    };
    if ((window as any).Chart) initChart();
    else { const s=document.createElement("script"); s.src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"; s.onload=initChart; document.head.appendChild(s); }
    return()=>{ if(chartRef.current){chartRef.current.destroy();chartRef.current=null;} };
  },[config, T]);
  const total=config.items.reduce((s,i)=>s+i.value,0);
  return (
    <div style={{ background:T.bgCard, borderRadius:10, padding:"12px 14px", border:`1px solid ${T.border}`, overflow:"visible" }}>
      <p style={{ fontSize:12, fontWeight:700, color:T.textPri, margin:"0 0 8px" }}>{config.title}</p>
      <div style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"center" }}>
        <div style={{ position:"relative", flexShrink:0, width:110, height:110, overflow:"visible" }}><canvas ref={canvasRef} /></div>
        <div style={{ display:"flex", flexDirection:"column", gap:4, flex:1, minWidth:0 }}>
          {config.items.map(item=>{
            const pct=total>0?((item.value/total)*100).toFixed(1):"0.0";
            return (
              <div key={item.label} style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                  <span style={{ width:6, height:6, borderRadius:2, background:item.color, display:"inline-block", flexShrink:0 }} />
                  <span style={{ fontSize:10, color:T.textMuted }}>{item.label}</span>
                </div>
                <span style={{ fontSize:10, fontWeight:600, color:T.textPri }}>{pct}%</span>
              </div>
            );
          })}
        </div>
          )}
      </div>
    </div>
  );
}

function DonutChartsRow({ kpi }: { kpi:any }) {
  const greenRamp=["#c8f04a","#a3e635","#84cc16","#65a30d","#3f6212"];
  const grayRamp=["rgba(180,180,180,0.85)","rgba(140,140,140,0.7)","rgba(100,100,100,0.55)","rgba(70,70,70,0.5)"];
  const configs:DonutConfig[]=[
    { id:"revenue", title:"매출 구성비", total:kpi?.revenue?.actual??null,
      items:[{label:"단과",value:267.1,color:greenRamp[0]},{label:"종합",value:772.8,color:greenRamp[1]},{label:"바자관",value:87.6,color:greenRamp[2]},{label:"교재/모의고사",value:112.0,color:greenRamp[3]},{label:"기타",value:16.4,color:greenRamp[4]}] },
    { id:"cogs", title:"매출원가 구성비", total:null,
      items:[{label:"단과",value:122.7,color:grayRamp[0]},{label:"종합",value:231.3,color:grayRamp[1]},{label:"교재/모의고사",value:105.7,color:grayRamp[2]},{label:"기타",value:16.1,color:grayRamp[3]}] },
    { id:"sga", title:"판관비 구성비", total:null,
      items:[{label:"급여",value:206.1,color:grayRamp[0]},{label:"감가상각비",value:98.5,color:grayRamp[1]},{label:"지급임차료",value:49.4,color:grayRamp[2]},{label:"광고선전비",value:23.8,color:"rgba(50,50,50,0.8)"},{label:"소모품비",value:8.4,color:"rgba(40,40,40,0.7)"},{label:"기타",value:160.6,color:"rgba(35,35,35,0.6)"}] },
  ];
  return <>{configs.map(cfg=><DonutChart key={cfg.id} config={cfg} />)}</>;
}

// ── 메인 ─────────────────────────────────────────────────────
export default function Dashboard() {
  const supabase=createClient();
  const router=useRouter();
  const { T } = useTheme();

  const CHART_CONFIGS = [
    { title:"매출",      accountId:1,   color:T.yellow },
    { title:"판관비",    accountId:128, color:T.green  },
    { title:"영업이익Ⅱ", accountId:285, color:T.yellow },
  ];

  useEffect(()=>{
    const checkAuth=async()=>{const{data:{user}}=await supabase.auth.getUser();if(!user)router.replace("/login");};
    checkAuth();
  },[]);

  const handleLogout=async()=>{
    const{data:{user}}=await supabase.auth.getUser();
    if(user){
      const{data:lastLog}=await supabase.from("access_logs").select("id,login_at").eq("user_id",user.id).is("logout_at",null).order("login_at",{ascending:false}).limit(1).single();
      if(lastLog){const duration=Math.floor((Date.now()-new Date(lastLog.login_at).getTime())/1000);await supabase.from("access_logs").update({logout_at:new Date().toISOString(),duration_sec:duration}).eq("id",lastLog.id);}
    }
    await supabase.auth.signOut();router.push("/login");
  };

  const [activeMenu,setActiveMenu]=useState("대시보드");
  const [filters,setFilters]=useState<FilterState>({year:2026,scenario:"actual",hq1:"전체",hq2:"전체",orgId:1});
  const [kpi,setKpi]=useState<any>(null);
  const [kpiLoading,setKpiLoading]=useState(true);
  const [chartDataMap,setChartDataMap]=useState<Record<number,any[]>>({});
  const [chartLoading,setChartLoading]=useState(true);
  const [pnlLabelA,setPnlLabelA]=useState("2026년");
  const [pnlLabelB,setPnlLabelB]=useState("2025년");
  const [pnlData,setPnlData]=useState<any>(null);
  const [pnlLoading,setPnlLoading]=useState(true);
  const [aiComment,setAiComment]=useState("");
  const [aiLoading,setAiLoading]=useState(false);
  const [aiGenerated,setAiGenerated]=useState(false);
  const [cagrStart,setCagrStart]=useState(2021);
  const [cagrEnd,setCagrEnd]=useState(2026);
  const [cagrData,setCagrData]=useState<any>(null);
  const [cagrLoading,setCagrLoading]=useState(true);

  const ALL_LABELS=["2015년","2016년","2017년","2018년","2019년","2020년","2021년","2022년","2023년","2024년","2025년","2025 사업계획","2026년","2026 사업계획","2026 개선목표"];

  const fetchKpi=useCallback(()=>{
    setKpiLoading(true);
    const p=new URLSearchParams({year:String(filters.year),org_id:String(filters.orgId),hq1:filters.hq1,hq2:filters.hq2});
    fetch(`/api/pnl/kpi?${p}`).then(r=>r.json()).then(setKpi).finally(()=>setKpiLoading(false));
  },[filters.year,filters.orgId,filters.hq1,filters.hq2]);

  const fetchCharts=useCallback(()=>{
    setChartLoading(true);
    const p=new URLSearchParams({year:String(filters.year),org_id:String(filters.orgId),hq1:filters.hq1,hq2:filters.hq2});
    Promise.all(CHART_CONFIGS_BASE.map(cfg=>fetch(`/api/pnl/monthly?${p}&account_id=${cfg.accountId}`).then(r=>r.json())))
      .then(results=>{const map:Record<number,any[]>={};CHART_CONFIGS_BASE.forEach((cfg,i)=>{map[cfg.accountId]=results[i].data??[];});setChartDataMap(map);})
      .catch(console.error).finally(()=>setChartLoading(false));
  },[filters.year,filters.orgId,filters.hq1,filters.hq2]);

  const fetchPnlDetail=useCallback(()=>{
    setPnlLoading(true);
    const p=new URLSearchParams({org_id:String(filters.orgId),hq1:filters.hq1,hq2:filters.hq2,label_a:pnlLabelA,label_b:pnlLabelB});
    fetch(`/api/pnl/detail?${p}`).then(r=>r.json()).then(setPnlData).catch(console.error).finally(()=>setPnlLoading(false));
  },[filters.orgId,filters.hq1,filters.hq2,pnlLabelA,pnlLabelB]);

  const fetchAiComment=useCallback(()=>{
    setAiLoading(true);
    const p=new URLSearchParams({year:String(filters.year),org_id:String(filters.orgId),hq1:filters.hq1,hq2:filters.hq2});
    fetch(`/api/pnl/ai-comment?${p}`).then(r=>r.json()).then(d=>{setAiComment(d.aiComment??"");setAiGenerated(true);}).catch(()=>setAiComment("AI 분석 오류가 발생했습니다.")).finally(()=>setAiLoading(false));
  },[filters.year,filters.orgId,filters.hq1,filters.hq2]);

  const fetchCagr=useCallback(()=>{
    if(cagrStart>=cagrEnd){setCagrData(null);setCagrLoading(false);return;}
    setCagrLoading(true);
    const p=new URLSearchParams({org_id:String(filters.orgId),hq1:filters.hq1,hq2:filters.hq2});
    Promise.all([fetch(`/api/pnl/kpi?${p}&year=${cagrStart}`).then(r=>r.json()),fetch(`/api/pnl/kpi?${p}&year=${cagrEnd}`).then(r=>r.json())])
      .then(([s,e])=>{const sv=s?.revenue?.actual,ev=e?.revenue?.actual,n=cagrEnd-cagrStart;if(sv&&ev&&n>0&&sv>0){setCagrData({cagr:Math.round((Math.pow(ev/sv,1/n)-1)*1000)/10,startRev:sv,endRev:ev,n});}else setCagrData(null);})
      .catch(()=>setCagrData(null)).finally(()=>setCagrLoading(false));
  },[cagrStart,cagrEnd,filters.orgId,filters.hq1,filters.hq2]);

  useEffect(()=>{fetchKpi();},[fetchKpi]);
  useEffect(()=>{fetchCharts();},[fetchCharts]);
  useEffect(()=>{fetchPnlDetail();},[fetchPnlDetail]);
  useEffect(()=>{fetchCagr();},[fetchCagr]);
  useEffect(()=>{setAiComment("");setAiGenerated(false);},[filters]);

  const ORG_NAME_MAP:Record<number,string>={1:"전체",2:"강남",3:"목동",4:"분당",5:"대구",6:"대전",7:"최상위권",8:"남학생",9:"여학생",10:"종합관",11:"대치"};
  const orgLabel=filters.orgId!==1?ORG_NAME_MAP[filters.orgId]??"전체":filters.hq2!=="전체"?filters.hq2:filters.hq1!=="전체"?filters.hq1:"전체";

  const selectSvg=`url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;
  const selStyle:React.CSSProperties={background:T.bgCard,border:`1px solid ${T.borderEm}`,borderRadius:7,padding:"4px 24px 4px 8px",fontSize:11,color:T.textPri,fontWeight:500,cursor:"pointer",outline:"none",appearance:"none",backgroundImage:selectSvg,backgroundRepeat:"no-repeat",backgroundPosition:"right 6px center"};

  const renderKpiCards=()=>{
    if(kpiLoading||!kpi||!kpi.revenue) return Array.from({length:4}).map((_,i)=>(
      <div key={i} style={{ background:T.bgCard, borderRadius:10, padding:"18px", border:`1px solid ${T.border}`, minHeight:140, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontSize:11, color:T.textMuted }}>로딩 중...</span>
      </div>
    ));
    const op2Yoy=kpi.op_profit2.prev!=null&&Math.abs(kpi.op_profit2.prev)<5?null:kpi.op_profit2.yoy;
    const cards=[
      {badge:"매출",      color:T.yellow, borderColor:T.yellow, value:fmt(kpi.revenue.actual),    yoy:kpi.revenue.yoy,   yoySuffix:"%",  yoyAbs:kpi.revenue.yoyAbs!=null?`${kpi.revenue.yoyAbs>=0?"+":""}${kpi.revenue.yoyAbs}억원`:null, targetLabel:"계획 대비", targetValue:kpi.revenue.achievement},
      {badge:"영업이익Ⅱ", color:T.yellow, borderColor:T.yellow, value:fmt(kpi.op_profit2.actual), yoy:op2Yoy,            yoySuffix:"%p", yoyAbs:kpi.op_profit2.yoyAbs!=null?`${kpi.op_profit2.yoyAbs>=0?"+":""}${kpi.op_profit2.yoyAbs}억원`:null, targetLabel:"계획 대비", targetValue:kpi.op_profit2.achievement},
      {badge:"영업이익률", color:T.green,  borderColor:T.green,  value:fmtPct(kpi.op_margin.actual), yoy:kpi.op_margin.yoy, yoySuffix:"%p", yoyAbs:null, targetLabel:"계획 대비", targetValue:kpi.op_margin.vs_plan, isRate:true},
      {badge:"목표달성률", color:T.green,  borderColor:T.green,  value:fmtPct(kpi.target_achievement.revenue_rate), yoy:null, yoySuffix:"%", yoyAbs:null, targetLabel:"달성금액", targetText:`${kpi.revenue.actual??"—"}억원 / ${kpi.revenue.plan??"—"}억원`, targetValue:kpi.target_achievement.revenue_rate},
    ];
    return cards.map((k:any)=>(
      <div key={k.badge} style={{ background:T.bgCard, borderRadius:10, padding:"16px 18px", border:`1px solid ${T.border}`, borderTop:`2px solid ${k.borderColor}`, display:"flex", flexDirection:"column", gap:8 }}>
        <span style={{ fontSize:11, fontWeight:700, color:k.color }}>{k.badge}</span>
        <div style={{ fontSize:26, fontWeight:800, letterSpacing:"-0.03em", color:T.textPri, lineHeight:1.1 }}>{k.value}</div>
        <div style={{ fontSize:11 }}>
          <span style={{ color:T.textMuted }}>전년 대비 </span>
          <Pill value={k.yoy??null} suffix={k.yoySuffix??"%"} />
          {k.yoyAbs&&<span style={{ color:T.textMuted, marginLeft:4 }}>({k.yoyAbs})</span>}
        </div>
        <div style={{ fontSize:11, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ color:T.textMuted }}>{k.targetLabel}</span>
          {k.targetText?<span style={{ fontWeight:600, fontSize:11, color:T.textPri }}>{k.targetText}</span>
            :k.isRate?<Pill value={k.targetValue??null} suffix="p"/>
            :<span style={{ fontWeight:700, fontSize:12, color:k.color }}>{k.targetValue!=null?fmtPct(k.targetValue):"—"}</span>}
        </div>
        {!k.isRate&&k.color&&<ProgressBar value={k.targetValue??null} color={k.color}/>}
      </div>
    ));
  };

  return (
    <div style={{ display:"flex", height:"100vh", width:"100vw", fontFamily:"'SUIT','Pretendard','Noto Sans KR',sans-serif", background:T.bgBase, color:T.textPri, overflow:"hidden" }}>

      {/* 사이드바 */}
      <aside style={{ width:200, flexShrink:0, background:T.bgSurface, display:"flex", flexDirection:"column", padding:"0 0 24px", borderRight:`1px solid ${T.border}` }}>
        <div style={{ padding:"18px 18px 16px", borderBottom:`1px solid ${T.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }} onClick={()=>router.push("/")}>
            
            <div style={{ fontSize:12, fontWeight:700, color:T.textPri }}>손익 Dashboard</div>
          </div>
        </div>
        <nav style={{ flex:1, padding:"12px 10px" }}>
          {MENU.map(m=>(
            <div key={m.label}>
              <button onClick={()=>{setActiveMenu(m.label);if(m.label==="FloorEdit")router.push("/floor");if(m.label==="단과 판매 분석")router.push("/sales");if(m.label==="개별 강사 현황")router.push("/instructor");}} style={{ width:"100%", display:"flex", alignItems:"center", gap:9, padding:"8px 10px", borderRadius:9, marginBottom:1, background:activeMenu===m.label?`rgba(245,196,24,0.1)`:"transparent", color:activeMenu===m.label?T.yellow:T.textMuted, border:activeMenu===m.label?`1px solid rgba(245,196,24,0.2)`:"1px solid transparent", cursor:"pointer", fontSize:12, fontWeight:activeMenu===m.label?700:400, textAlign:"left", borderLeft:activeMenu===m.label?`2px solid ${T.yellow}`:"2px solid transparent" }}>
                <span>{m.icon}</span>{m.label}
              </button>
              {(m as any).sub&&(
                <div style={{ paddingLeft:10, marginBottom:2 }}>
                  {(m as any).sub.map((s:any)=>(
                    <button key={s.label} onClick={()=>{setActiveMenu(s.label);if(s.label==="등록 추이(전체)")router.push("/students/enrollment/all");if(s.label==="등록 추이(학원별)")router.push("/students/enrollment");if(s.label==="입결 현황")router.push("/students/scores");if(s.label==="월간 보고서")router.push("/report");}} style={{ width:"100%", display:"flex", alignItems:"center", gap:6, padding:"6px 10px", borderRadius:8, marginBottom:1, background:activeMenu===s.label?`rgba(245,196,24,0.08)`:"transparent", color:activeMenu===s.label?T.yellow:T.textMuted, border:"1px solid transparent", cursor:"pointer", fontSize:11, fontWeight:activeMenu===s.label?700:400, textAlign:"left" }}>
                      <span style={{ fontSize:9, color:activeMenu===s.label?T.yellow:T.textHint }}>└</span><span>{s.icon}</span>{s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div style={{ borderTop:`1px solid ${T.border}`, marginTop:8, paddingTop:8 }}>
            <button onClick={()=>router.push("/admin")} style={{ width:"100%", display:"flex", alignItems:"center", gap:9, padding:"8px 10px", borderRadius:9, marginBottom:1, background:"transparent", color:T.textMuted, border:"1px solid transparent", cursor:"pointer", fontSize:12, textAlign:"left" }}><span>🔐</span>접속 로그</button>
            <button onClick={handleLogout} style={{ width:"100%", display:"flex", alignItems:"center", gap:9, padding:"8px 10px", borderRadius:9, background:"transparent", color:T.textMuted, border:"1px solid transparent", cursor:"pointer", fontSize:12, textAlign:"left" }}><span>🚪</span>로그아웃</button>
          </div>
        </nav>
        <div style={{ padding:"12px 14px", borderTop:`1px solid ${T.border}` }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:30, height:30, background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13 }}>👤</div>
            <div><div style={{ fontSize:11, fontWeight:600, color:T.textPri }}>홍길동 관리자</div><div style={{ fontSize:9, color:T.textMuted }}>중점본부</div></div>
          </div>
        </div>
      </aside>

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        <FilterBar filters={filters} onChange={setFilters} updatedAt="2026.05.07 10:30" />

        <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
          <div style={{ flex:1, overflow:"auto", padding:"14px 22px" }}>

          {/* 조회 조건 */}
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, flexWrap:"wrap" }}>
            <span style={{ fontSize:11, color:T.textMuted }}>조회 조건:</span>
            {[`${filters.year}년`, orgLabel!=="전체"?orgLabel:null].filter(Boolean).map(badge=>(
              <span key={badge} style={{ fontSize:10, background:`rgba(245,196,24,0.12)`, color:T.yellow, padding:"2px 8px", borderRadius:20, fontWeight:600, border:`1px solid rgba(245,196,24,0.2)` }}>{badge}</span>
            ))}
            {filters.year>=2026&&<span style={{ fontSize:10, color:T.textMuted, marginLeft:4 }}>* 2026년은 4월까지의 실적과 5~12월의 추정치입니다.</span>}
          </div>

          {/* AI 분석 */}
          <div style={{ marginBottom:12 }}>
            {!aiGenerated?(
              <div style={{ background:T.bgCard, border:`1px solid rgba(245,196,24,0.15)`, borderRadius:10, padding:"16px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:T.yellow }}>AI 분석 코멘트</div>
                  <div style={{ fontSize:10, color:T.textMuted }}>현재 조회 조건 기준으로 분석합니다</div>
                </div>
                <button onClick={fetchAiComment} disabled={aiLoading} style={{ padding:"8px 20px", borderRadius:8, border:"none", background:aiLoading?`rgba(245,196,24,0.2)`:T.yellow, color:aiLoading?T.textMuted:"#000", fontSize:12, fontWeight:700, cursor:aiLoading?"not-allowed":"pointer", transition:"all 0.15s" }}>
                  {aiLoading?"분석 중...":"AI 분석 시작"}
                </button>
              </div>
            ):(
              <div style={{ position:"relative" }}>
                <AiComment text={aiComment} />
                <button onClick={()=>{setAiComment("");setAiGenerated(false);}} style={{ position:"absolute", top:14, right:14, background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:7, padding:"3px 9px", fontSize:10, color:T.textMuted, cursor:"pointer" }}>재분석</button>
              </div>
            )}
          </div>

          {/* KPI 5개 */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:12 }}>
            <div style={{ background:T.bgCard, borderRadius:10, padding:"16px 18px", border:`1px solid ${T.border}`, borderTop:`2px solid ${T.green}`, display:"flex", flexDirection:"column", gap:8 }}>
              <span style={{ fontSize:11, fontWeight:700, color:T.green }}>연평균성장률</span>
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <select value={cagrStart} onChange={e=>setCagrStart(Number(e.target.value))} style={{ ...selStyle, flex:1 }}>
                  {[2021,2022,2023,2024,2025].map(y=><option key={y} value={y}>{y}년</option>)}
                </select>
                <span style={{ fontSize:10, color:T.textMuted, flexShrink:0 }}>~</span>
                <select value={cagrEnd} onChange={e=>setCagrEnd(Number(e.target.value))} style={{ ...selStyle, flex:1 }}>
                  {[2022,2023,2024,2025,2026].filter(y=>y>cagrStart).map(y=><option key={y} value={y}>{y}년</option>)}
                </select>
              </div>
              <div style={{ fontSize:26, fontWeight:800, letterSpacing:"-0.03em", color:T.textPri, lineHeight:1.1 }}>{cagrLoading?"—":cagrData?fmtPct(cagrData.cagr):"—"}</div>
              <div style={{ fontSize:10, color:T.textMuted }}>{cagrData?`${cagrStart}년 ${cagrData.startRev}억 → ${cagrEnd}년 ${cagrData.endRev}억`:"연도를 선택해주세요"}</div>
              <div style={{ fontSize:10, color:T.textHint }}>매출 기준 · {cagrData?`${cagrData.n}개년`:""}</div>
            </div>
            {renderKpiCards()}
          </div>

          {/* 메인 2열 */}
          <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr", gap:10 }}>
            <div style={{ display:"flex", flexDirection:"column", gap:10, overflow:"visible" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                {CHART_CONFIGS.map(cfg=>(
                  <div key={cfg.accountId} style={{ background:T.bgCard, borderRadius:10, padding:"10px 12px", border:`1px solid ${T.border}` }}>
                    <div style={{ fontSize:10, fontWeight:700, color:T.textPri, marginBottom:1 }}>월별 {cfg.title} 추이</div>
                    <div style={{ fontSize:8, color:T.textMuted, marginBottom:4 }}>{yearLabel(filters.year)} vs {filters.year-1}년</div>
                    <div style={{ display:"flex", gap:8, marginBottom:4 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:3, fontSize:8, color:T.textMuted }}><span style={{ width:7,height:7,borderRadius:2,background:cfg.color,display:"inline-block" }}></span>{yearLabel(filters.year)}</div>
                      <div style={{ display:"flex", alignItems:"center", gap:3, fontSize:8, color:T.textMuted }}><span style={{ width:7,height:7,borderRadius:2,background:"rgba(150,150,150,0.5)",display:"inline-block" }}></span>{filters.year-1}년</div>
                    </div>
                    {chartLoading?<div style={{ height:90, display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:10, color:T.textMuted }}>로딩 중...</span></div>
                      :<MonthlyChart data={chartDataMap[cfg.accountId]??[]} year={filters.year} color={cfg.color} height={90} />}
                  </div>
                ))}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, overflow:"visible" }}>
                <DonutChartsRow kpi={kpi} />
              </div>
              <NaverMap year={filters.year} orgId={filters.orgId} hq1={filters.hq1} hq2={filters.hq2} />
            </div>

            {/* 우측: 손익 상세 */}
            <div style={{ background:T.bgCard, borderRadius:10, padding:"14px", border:`1px solid ${T.border}`, display:"flex", flexDirection:"column", position:"sticky", top:0, maxHeight:"calc(100vh - 90px)", overflow:"hidden" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10, flexWrap:"wrap", gap:6 }}>
                <div style={{ fontSize:12, fontWeight:700, color:T.textPri }}>손익 상세 현황</div>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                    <span style={{ fontSize:8, color:T.textMuted }}>기준</span>
                    <select value={pnlLabelA} onChange={e=>setPnlLabelA(e.target.value)} style={selStyle}>
                      {ALL_LABELS.map(l=><option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                  <span style={{ fontSize:10, color:T.textMuted }}>vs</span>
                  <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                    <span style={{ fontSize:8, color:T.textMuted }}>비교</span>
                    <select value={pnlLabelB} onChange={e=>setPnlLabelB(e.target.value)} style={selStyle}>
                      {ALL_LABELS.map(l=><option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              {pnlLoading||!pnlData
                ?<div style={{ padding:"40px", textAlign:"center", color:T.textMuted, fontSize:11 }}>로딩 중...</div>
                :(
                  <div style={{ overflow:"auto", flex:1 }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                      <thead>
                        <tr style={{ borderBottom:`1px solid ${T.borderEm}`, background:T.bgSurface }}>
                          <th style={{ padding:"8px 10px", textAlign:"left", color:T.textMuted, fontWeight:600, minWidth:120, height:34 }}>계정</th>
                          <th style={{ padding:"6px 8px", textAlign:"right", color:T.textPri, fontWeight:700 }}>{pnlData.labelA}</th>
                          <th style={{ padding:"6px 8px", textAlign:"right", color:T.textMuted, fontWeight:500 }}>{pnlData.labelB}</th>
                          <th style={{ padding:"6px 8px", textAlign:"right", color:T.textMuted, fontWeight:500 }}>차이(억원)</th>
                          <th style={{ padding:"6px 8px", textAlign:"right", color:T.textMuted, fontWeight:500 }}>대비(%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pnlData.rows.map((row:any,i:number)=>(
                          <tr key={i} style={{ borderBottom:`1px solid ${T.gridLine}`, background:row.highlight?`rgba(245,196,24,0.06)`:"transparent", fontWeight:row.bold?700:400, height:33 }}
                            onMouseEnter={e=>{if(!row.highlight)e.currentTarget.style.background=`rgba(0,0,0,0.03)`;}}
                            onMouseLeave={e=>{if(!row.highlight)e.currentTarget.style.background="transparent";}}>
                            <td style={{ padding:"0 10px", color:row.highlight?T.yellow:T.textPri, height:33, verticalAlign:"middle" }}>
                              <span style={{ paddingLeft:row.indent*14, display:"flex", alignItems:"center", gap:4 }}>
                                {row.indent>0&&<span style={{ color:T.textHint, fontSize:9 }}>└</span>}{row.label}
                              </span>
                            </td>
                            <td style={{ padding:"0 8px", textAlign:"right", fontWeight:row.bold?700:500, height:33, verticalAlign:"middle" }}>{row.isRate?`${row.valueA?.toFixed(1)??"—"}%`:row.valueA!=null?row.valueA.toLocaleString("ko-KR"):"—"}</td>
                            <td style={{ padding:"0 8px", textAlign:"right", color:T.textMuted, height:33, verticalAlign:"middle" }}>{row.isRate?`${row.valueB?.toFixed(1)??"—"}%`:row.valueB!=null?row.valueB.toLocaleString("ko-KR"):"—"}</td>
                            <td style={{ padding:"0 8px", textAlign:"right", height:33, verticalAlign:"middle" }}>
                              {row.diffAbs!=null?<span style={{ color:row.diffAbs>=0?T.up:T.dn, fontWeight:600 }}>{row.diffAbs>=0?"+":""}{row.isRate?`${row.diffAbs.toFixed(1)}%p`:row.diffAbs.toLocaleString("ko-KR")}</span>:"—"}
                            </td>
                            <td style={{ padding:"0 8px", textAlign:"right", height:33, verticalAlign:"middle" }}>
                              {row.isRate||row.diffPct==null?"—":<span style={{ color:row.diffPct>=0?T.up:T.dn, fontWeight:600 }}>{row.diffPct>=0?"▲":"▼"} {Math.abs(row.diffPct).toFixed(1)}%</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}