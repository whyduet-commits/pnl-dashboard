// src/components/dashboard/NaverMap.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/theme";

// ── 학원 데이터 ───────────────────────────────────────────────
const ACADEMIES = [
  { id: 2,  name: "강남",   lat: 37.4931, lng: 127.0316, area: "서울",
    region: "서울 서초구 서초중앙로22길 17",   fullName: "메가스터디 러셀 강남학원" },
  { id: 3,  name: "목동",   lat: 37.5289, lng: 126.8601, area: "서울",
    region: "서울 양천구 신월로 358",          fullName: "메가스터디 러셀 목동학원" },
  { id: 11, name: "대치",   lat: 37.4946, lng: 127.0623, area: "서울",
    region: "서울 강남구 대치동",              fullName: "메가스터디 대치학원" },
  { id: 4,  name: "분당",   lat: 37.3617, lng: 127.1086, area: "경기도",
    region: "경기 성남시 분당구 성남대로 381", fullName: "메가스터디 러셀 분당" },
  { id: 7,  name: "최상위권", lat: 37.1889, lng: 127.3312, area: "경기도",
    region: "경기 용인시 처인구 원삼면 사암리 8-1", fullName: "최상위권 전문관 러셀 기숙학원" },
  { id: 9,  name: "여학생", lat: 37.2126, lng: 127.2786, area: "경기도",
    region: "경기 용인시 처인구 양지면 제일리 603", fullName: "여학생 전문관 러셀 기숙학원" },
  { id: 8,  name: "남학생", lat: 37.1401, lng: 127.3156, area: "경기도",
    region: "경기 용인시 처인구 백암면 고안로51번길 94", fullName: "남학생 전문관 러셀 기숙학원" },
  { id: 10, name: "종합관", lat: 37.2089, lng: 127.2831, area: "경기도",
    region: "경기 용인시 처인구 양지면 중부대로 2582-6", fullName: "메가스터디 기숙학원 종합관" },
  { id: 6,  name: "대전",   lat: 36.3538, lng: 127.3867, area: "충청도",
    region: "대전 서구 둔산동 1407 엠시티타워", fullName: "메가스터디 러셀 대전" },
  { id: 5,  name: "대구",   lat: 35.8617, lng: 128.6302, area: "경상도",
    region: "대구 수성구 달구벌대로 2472",     fullName: "메가스터디 러셀 대구학원" },
];

const AREAS = ["전체","서울","경기도","강원도","충청도","전라도","경상도","제주도"];

const AREA_VIEW: Record<string, { lat:number; lng:number; zoom:number }> = {
  "전체":  { lat:36.5,    lng:127.8,   zoom:7  },
  "서울":  { lat:37.5665, lng:126.978, zoom:11 },
  "경기도": { lat:37.275,  lng:127.2,   zoom:9  },
  "강원도": { lat:37.555,  lng:128.209, zoom:8  },
  "충청도": { lat:36.45,   lng:127.5,   zoom:9  },
  "전라도": { lat:35.416,  lng:127.389, zoom:8  },
  "경상도": { lat:35.73,   lng:128.5,   zoom:8  },
  "제주도": { lat:33.489,  lng:126.498, zoom:10 },
};

interface AcademyKpi {
  org_id: number; revenue: number; revYoy: number|null; op2: number; op2Yoy: number|null;
}
interface Props { year:number; orgId:number; hq1:string; hq2:string; }

export default function NaverMap({ year }: Props) {
  const { theme, T } = useTheme();
  const mapRef     = useRef<HTMLDivElement>(null);
  const mapObj     = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const [kpiMap,     setKpiMap]     = useState<Record<number,AcademyKpi>>({});
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState<(typeof ACADEMIES)[0]|null>(null);
  const [mapReady,   setMapReady]   = useState(false);
  const [areaFilter, setAreaFilter] = useState("전체");

  const filteredAcademies = areaFilter==="전체" ? ACADEMIES : ACADEMIES.filter(a=>a.area===areaFilter);

  // 다크/라이트 모드에 따라 지도 필터 적용
  useEffect(() => {
    if (!mapRef.current) return;
    if (theme === "dark") {
      mapRef.current.style.filter = "invert(90%) hue-rotate(180deg) brightness(0.85) contrast(0.9)";
    } else {
      mapRef.current.style.filter = "none";
    }
  }, [theme, mapReady]);

  // ── KPI 조회 ──────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.all(
      ACADEMIES.map(a =>
        fetch(`/api/pnl/kpi?org_id=${a.id}&year=${year}&hq1=전체&hq2=전체`)
          .then(r=>r.json())
          .then(d=>({ org_id:a.id, revenue:d?.revenue?.actual??0, revYoy:d?.revenue?.yoy??null, op2:d?.op_profit2?.actual??0, op2Yoy:d?.op_profit2?.yoy??null }))
          .catch(()=>({ org_id:a.id, revenue:0, revYoy:null, op2:0, op2Yoy:null }))
      )
    ).then(results=>{
      const m:Record<number,AcademyKpi>={};
      results.forEach(r=>{m[r.org_id]=r;});
      setKpiMap(m); setLoading(false);
    });
  }, [year]);

  // ── 지도 초기화 ───────────────────────────────────────────
  useEffect(() => {
    const initMap = () => {
      if (!mapRef.current || !(window as any).naver) return;
      const naver = (window as any).naver;
      const v = AREA_VIEW["전체"];
      mapObj.current = new naver.maps.Map(mapRef.current, {
        center: new naver.maps.LatLng(v.lat, v.lng),
        zoom: v.zoom,
        mapTypeControl:false, scaleControl:false,
        logoControl:false, mapDataControl:false,
        mapTypeId: naver.maps.MapTypeId.NORMAL,
      });
      // 초기 테마 필터 적용
      if (mapRef.current) {
        mapRef.current.style.filter = theme==="dark"
          ? "invert(90%) hue-rotate(180deg) brightness(0.85) contrast(0.9)"
          : "none";
      }
      setMapReady(true);
    };
    if ((window as any).naver?.maps) { initMap(); }
    else {
      const s=document.createElement("script");
      s.src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=pjjr0ehie4";
      s.async=true; s.onload=initMap;
      document.head.appendChild(s);
    }
  }, []);

  // ── 지역 필터 → 지도 이동 ─────────────────────────────────
  useEffect(() => {
    if (!mapReady||!mapObj.current) return;
    const naver=(window as any).naver;
    const v=AREA_VIEW[areaFilter]??AREA_VIEW["전체"];
    mapObj.current.setCenter(new naver.maps.LatLng(v.lat,v.lng));
    mapObj.current.setZoom(v.zoom);
  }, [areaFilter, mapReady]);

  // ── 마커 렌더링 ───────────────────────────────────────────
  useEffect(() => {
    if (!mapReady||loading||!mapObj.current) return;
    const naver=(window as any).naver;
    markersRef.current.forEach(m=>m.setMap(null));
    markersRef.current=[];
    const maxRev=Math.max(...ACADEMIES.map(a=>kpiMap[a.id]?.revenue??0),1);

    filteredAcademies.forEach(academy=>{
      const kpi=kpiMap[academy.id];
      const rev=kpi?.revenue??0, yoy=kpi?.revYoy??null;
      const isUp=yoy==null?true:yoy>=0;
      const size=Math.max(30,Math.min(58,Math.round(rev/maxRev*58)));
      const half=Math.round(size/2);
      const color   =isUp?"#c8f04a":"#ef4444";
      const txtColor=isUp?"#0a0a0a":"#fff";
      const yoyStr  =yoy!=null?`${yoy>=0?"▲":"▼"}${Math.abs(yoy).toFixed(1)}%`:"—";

      const html=`
        <div style="width:${size}px;height:${size}px;background:${color};border-radius:50%;
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.25);border:2px solid rgba(255,255,255,0.15);">
          <span style="font-size:${size>42?10:9}px;font-weight:700;color:${txtColor};line-height:1.2;text-align:center;">${academy.name}</span>
          ${size>38?`<span style="font-size:8px;color:${txtColor};opacity:0.9;">${yoyStr}</span>`:""}
        </div>`;

      const marker=new naver.maps.Marker({
        position:new naver.maps.LatLng(academy.lat,academy.lng),
        map:mapObj.current,
        icon:{ content:html, anchor:new naver.maps.Point(half,half) },
        title:academy.name,
      });
      naver.maps.Event.addListener(marker,"click",()=>setSelected(academy));
      markersRef.current.push(marker);
    });
  }, [mapReady, loading, kpiMap, filteredAcademies]);

  const areaRevenue=AREAS.filter(a=>a!=="전체").map(area=>{
    const acs=ACADEMIES.filter(a=>a.area===area);
    const totalRev=acs.reduce((s,a)=>s+(kpiMap[a.id]?.revenue??0),0);
    const totalOp2=acs.reduce((s,a)=>s+(kpiMap[a.id]?.op2??0),0);
    return { area, totalRev, totalOp2, hasData:acs.length>0&&totalRev>0, count:acs.length };
  }).filter(a=>a.hasData).sort((a,b)=>b.totalRev-a.totalRev);

  const maxAreaRev=Math.max(...areaRevenue.map(a=>a.totalRev),1);
  const selKpi=selected?kpiMap[selected.id]:null;

  // 라이트 모드용 색상 보정
  const cardBg     = T.bgCard;
  const panelBg    = theme==="dark" ? "#1e1e1e" : "#f8f8f8";
  const borderCol  = T.border;
  const textPri    = T.textPri;
  const textMuted  = T.textMuted;
  const mapBg      = theme==="dark" ? "#0a0a0a" : "#e8e8e8";

  return (
    <div style={{ background:cardBg, borderRadius:12, padding:"14px", border:`1px solid ${borderCol}` }}>
      {/* 헤더 */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8, flexWrap:"wrap", gap:6 }}>
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:textPri }}>학원별 매출 현황</div>
          <div style={{ fontSize:11, color:textMuted }}>
            {year>=2026?`${year}년(E)`:`${year}년`} · 버블 크기 = 매출액
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {[{color:"#c8f04a",label:"YoY ▲"},{color:"#ef4444",label:"YoY ▼"}].map(l=>(
            <div key={l.label} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:textMuted }}>
              <span style={{ width:9,height:9,borderRadius:"50%",background:l.color,display:"inline-block" }}/>{l.label}
            </div>
          ))}
        </div>
      </div>

      {/* 지역 필터 버튼 */}
      <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10 }}>
        {AREAS.map(area=>(
          <button key={area} onClick={()=>setAreaFilter(area)} style={{
            padding:"3px 10px", borderRadius:20, fontSize:11, cursor:"pointer",
            border: areaFilter===area ? `1px solid ${T.yellow}` : `1px solid ${borderCol}`,
            background: areaFilter===area ? T.yellow : panelBg,
            color: areaFilter===area ? "#fff" : textMuted,
            fontWeight: areaFilter===area ? 700 : 400, transition:"all 0.15s",
          }}>{area}</button>
        ))}
      </div>

      {/* 지도 + 사이드패널 */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 170px", gap:12, alignItems:"start" }}>

        {/* 지도 */}
        <div ref={mapRef} style={{ width:"100%", height:570, borderRadius:12, overflow:"hidden", background:mapBg }}>
          {!mapReady&&(
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", fontSize:12, color:textMuted }}>
              지도 로딩 중...
            </div>
          )}
        </div>

        {/* 우측 패널 */}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>

          {/* 선택 학원 카드 */}
          <div style={{ background:panelBg, borderRadius:10, padding:"12px", border:`1px solid ${borderCol}`, minHeight:110 }}>
            {selected&&selKpi?(
              <>
                <div style={{ fontSize:12, fontWeight:700, color:textPri, marginBottom:2 }}>{selected.name}</div>
                <div style={{ fontSize:9, color:textMuted, marginBottom:8, lineHeight:1.4 }}>{selected.region}</div>
                <div>
                  <div style={{ fontSize:9, color:textMuted }}>매출</div>
                  <div style={{ fontSize:14, fontWeight:700, color:textPri }}>{selKpi.revenue}억원</div>
                  {selKpi.revYoy!=null&&(
                    <div style={{ fontSize:10, fontWeight:600, color:selKpi.revYoy>=0?T.up:T.dn }}>
                      {selKpi.revYoy>=0?"▲":"▼"}{Math.abs(selKpi.revYoy).toFixed(1)}% YoY
                    </div>
                  )}
                  <div style={{ borderTop:`1px solid ${borderCol}`, marginTop:6, paddingTop:6 }}>
                    <div style={{ fontSize:9, color:textMuted }}>영업이익Ⅱ</div>
                    <div style={{ fontSize:13, fontWeight:700, color:textPri }}>{selKpi.op2}억원</div>
                  </div>
                </div>
              </>
            ):(
              <div style={{ fontSize:11, color:textMuted, textAlign:"center", paddingTop:28 }}>마커를 클릭하세요</div>
            )}
          </div>

          {/* 지역별 매출 순위 */}
          <div style={{ background:panelBg, borderRadius:10, padding:"12px", border:`1px solid ${borderCol}` }}>
            <div style={{ fontSize:11, fontWeight:700, color:textPri, marginBottom:8 }}>지역별 매출</div>
            {loading?(
              <div style={{ fontSize:11, color:textMuted }}>로딩 중...</div>
            ):(
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {areaRevenue.map((ar,i)=>{
                  const pct=Math.round(ar.totalRev/maxAreaRev*100);
                  return (
                    <div key={ar.area} style={{ cursor:"pointer" }} onClick={()=>setAreaFilter(ar.area)}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <span style={{ fontSize:10, color:areaFilter===ar.area?T.yellow:textPri, fontWeight:areaFilter===ar.area?700:400 }}>
                          {i+1}. {ar.area}
                        </span>
                        <span style={{ fontSize:9, color:textMuted }}>{ar.count}개</span>
                      </div>
                      <div style={{ background:`rgba(128,128,128,0.15)`, borderRadius:3, height:3, marginTop:2, overflow:"hidden" }}>
                        <div style={{ width:`${pct}%`, height:"100%",
                          background:areaFilter===ar.area?T.yellow:"rgba(200,240,74,0.5)",
                          borderRadius:3 }}/>
                      </div>
                      <div style={{ fontSize:9, color:textMuted, fontWeight:600 }}>
                        {ar.totalRev.toFixed(1)}억원
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}