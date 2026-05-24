# upload_teachers.py
# 실행: python upload_teachers.py
# 위치: C:\pnl-dashboard\
# 동작:
#   1. teachers/ 폴더의 PNG 파일을 Supabase Storage에 업로드
#   2. instructor_profiles 테이블에 매핑 데이터 INSERT

import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env.local")

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# 사진 폴더 경로
PHOTO_DIR = r"C:\Users\whydu\Desktop\data-upload\teachers"
BUCKET    = "teachers"

# 영문 파일명 → 한국어 강사명 매핑
MAPPING = {
    "ahn_donggyun": "안동균", "ahn_jaeuk": "안재욱", "ba_reunchan": "바른찬",
    "bae_gieun": "배기은", "bae_junho": "배준호", "baek_cheongun": "백천군",
    "baek_seungho": "백승호", "ban_hyentae": "반현태", "byen_doil": "변도일",
    "cho_jeongsik": "조정식", "cho_minseo": "조민서", "cho_seonghun": "조성훈",
    "cho_yongman": "조용만", "choi_dohyen": "최도현", "choi_haena": "최해나",
    "choi_inho": "최인호", "choi_jeok": "최적", "choi_seokho": "최석호",
    "choi_yongjin": "최용진", "eom_jeongae": "엄정애", "ga_yun": "가윤",
    "guk_dogyun": "국도균", "gwak_dongryeng": "곽동령", "gwak_minseok": "곽민석",
    "ham_jeongmin": "함정민", "ham_jiyeng": "함지영", "ham_seokjin": "함석진",
    "han_jongcheol": "한종철", "han_sehun": "한세훈", "han_serin": "한세린",
    "heo_sunyong": "허선용", "hwang_jinseob": "황진섭", "hwang_minjun": "황민준",
    "hwang_suhwan": "황수환", "hyenjaui_dol": "현재의돌", "jang_jinseok": "장진석",
    "jang_mi": "장미", "jang_won": "장원", "jang_yengjin": "장영진",
    "jeon_gyengsik": "전경식", "jeon_isu": "전이수", "jin_yundo": "진윤도",
    "jung_changmin": "정창민", "jung_damon": "정다몬", "jung_gahyen": "정가현",
    "jung_hungu": "정훈구", "jung_ije": "정이제", "jung_jeong": "정정",
    "jung_jikhan": "정직한", "jung_mina": "정미나", "jung_nakhun": "정낙훈",
    "jung_seongwon": "정성원", "jung_ujeong": "정우정", "jung_yujin": "정유진",
    "kang_haeun": "강해은", "kang_hun": "강훈", "kang_inseon": "강인선",
    "kang_mincheol": "강민철", "kang_mingi": "강민기", "kang_minung": "강민웅",
    "kang_rahyen": "강라현", "kang_sangsik": "강상식", "kang_sinyeng": "강신영",
    "kang_subin": "강수빈", "kang_yengchan": "강영찬", "kang_yengman": "강영만",
    "kim_aram": "김아람", "kim_ayen": "김아연", "kim_changyong": "김창용",
    "kim_darae": "김다래", "kim_dohyeng": "김도형", "kim_dongu": "김동우",
    "kim_doyen(satam)": "김도연", "kim_gangmin": "김강민", "kim_garam": "김가람",
    "kim_gicheol": "김기철", "kim_gihyen": "김기현", "kim_hakrim": "김학림",
    "kim_hansol": "김한솔", "kim_huichang": "김희창", "kim_huiseok": "김희석",
    "kim_hyengmin": "김형민", "kim_hyenseok": "김현석", "kim_hyesu": "김혜수",
    "kim_jaegwon": "김재권", "kim_jaewan": "김재완", "kim_jeni": "김제니",
    "kim_jeongdae": "김정대", "kim_jeongwon(gukeo)": "김정원", "kim_jihun": "김지훈",
    "kim_jinseong": "김진성", "kim_jiyeng": "김지영", "kim_jonghyen": "김종현",
    "kim_jongik": "김종익", "kim_jongung": "김종웅", "kim_juyen": "김주연",
    "kim_mingyeng": "김민경", "kim_minseok": "김민석", "kim_namjun": "김남준",
    "kim_saebyel": "김새별", "kim_saeyen": "김새연", "kim_sanghun": "김상훈",
    "kim_seondeok": "김선덕", "kim_seongeun": "김성은", "kim_seongjae": "김성재",
    "kim_seongmin": "김성민", "kim_seongyen": "김성연", "kim_seungju(yengeo)": "김승주",
    "kim_sora": "김소라", "kim_suyeng": "김수영", "kim_taehyeng": "김태형",
    "kim_taejin": "김태진", "kim_uju": "김우주", "kim_wonbin": "김원빈",
    "kim_yenghwan": "김영환", "kim_yengyeng": "김영영", "kim_yenho": "김영호",
    "kim_yenjae": "김영재", "kim_yongtaek": "김용택", "kim_yuhan": "김유한",
    "kim_yunjae": "김윤재", "ko_byengbin": "고병빈", "ko_byenghun": "고병훈",
    "ko_doyen": "고도연", "ko_geon": "고건", "ko_jeongjae": "고정재",
    "ko_suhyen": "고수현", "koo_doyeng": "구도영", "koo_seongeun": "구성은",
    "kwon_dongu": "권동우", "kwon_jomin": "권조민", "lee_bora": "이보라",
    "lee_dogyeng": "이도경", "lee_eunhaeng": "이은행", "lee_gisang": "이기상",
    "lee_giyeng": "이기영", "lee_hyensu": "이현수", "lee_jisu": "이지수",
    "lee_junho": "이준호", "lee_mingi": "이민기", "lee_minsu": "이민수",
    "lee_seokjun": "이석준", "lee_sumin": "이수민", "lee_wonjun": "이원준",
    "lee_yanggeun": "이양근", "lim_byel": "임별", "lim_jongyun": "임종윤",
    "ma_hyenseung": "마현승", "michin_gukeo": "미친국어", "min_donghwi": "민동휘",
    "min_hyeseon": "민혜선", "min_jeong": "민정", "min_junsik": "민준식",
    "mun_ahyen": "문아현", "mun_hosang": "문호상", "mun_jaewon": "문재원",
    "mun_jihyen(suhak)": "문지현", "mun_seongho": "문성호", "nam_hyeyeng": "남혜영",
    "nam_jiwon": "남지원", "nam_yunwon": "남윤원", "noh_gyengmin": "노경민",
    "oh_reusae": "오르세", "oh_songeun": "오송은", "oh_yenju": "오연주",
    "park_changyel": "박창열", "park_dam": "박담", "park_eunju": "박은주",
    "park_geonsu": "박건수", "park_geontae": "박건태", "park_giho": "박기호",
    "park_inyeng": "박인영", "park_jaechan": "박재찬", "park_jaehyeng": "박재형",
    "park_jeongbeom": "박정범", "park_jeongeun": "박정은", "park_jieun": "박지은",
    "park_jihyang": "박지향", "park_jinhyek": "박진혁", "park_jisu(jenipeo)": "박지수",
    "park_juhyek": "박주혁", "park_mincheol": "박민철", "park_mingyu": "박민규",
    "park_naeun": "박나은", "park_sara": "박사라", "park_seoeun": "박서은",
    "park_seokjun": "박석준", "park_seongwon": "박성원", "park_sinyeng": "박신영",
    "park_siu": "박시우", "park_soyen": "박소연", "park_soyeng": "박소영",
    "park_subin": "박수빈", "park_yengho": "박영호", "ryu_hyenjun": "류현준",
    "seo_jeongmin": "서정민", "seo_wonhui": "서원희", "shin_haneul": "신하늘",
    "shin_seonggyu": "신성규", "shin_seunghwan": "신승환", "shin_yongseon": "신용선",
    "sim_jiyen": "심지연", "sim_suhyen": "심수현", "so_yuyen": "소유연",
    "sohn_goun": "손고운", "sohn_uhyek": "손우혁", "sohn_wonjae": "손원재",
    "song_hwaseong": "송화성", "song_jihui": "송지희", "song_yuntae": "송윤태",
    "tae_in": "태인", "wi_daeyeng": "위대영", "woo_yengho": "우영호",
    "yang_iseok": "양이석", "yang_seungjin": "양승진", "yoon_minhyek": "윤민혁",
    "yoon_seonguk": "윤성욱", "yoon_yeeun": "윤예은", "yu_jin": "유진",
    "yu_min": "유민",
}

def main():
    # 사진 파일 목록
    if not os.path.exists(PHOTO_DIR):
        print(f"❌ 폴더를 찾을 수 없습니다: {PHOTO_DIR}")
        return

    files = [f for f in os.listdir(PHOTO_DIR) if f.lower().endswith('.png')]
    print(f"사진 파일 {len(files)}개 발견\n")

    # ── STEP 1: Storage 업로드 ──
    print("[1/2] Storage 업로드 중...")
    uploaded = {}
    for i, fname in enumerate(sorted(files)):
        key = fname.replace('.png', '')
        fpath = os.path.join(PHOTO_DIR, fname)
        with open(fpath, 'rb') as f:
            content = f.read()
        try:
            supabase.storage.from_(BUCKET).upload(
                path=fname,
                file=content,
                file_options={"content-type": "image/png", "upsert": "true"}
            )
        except Exception as e:
            print(f"  ⚠ {fname}: {e}")
        public_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{fname}"
        uploaded[key] = public_url
        print(f"  {i+1}/{len(files)} {fname}", end="\r")

    print(f"\n  업로드 완료: {len(uploaded)}개\n")

    # ── STEP 2: instructor_profiles INSERT ──
    print("[2/2] instructor_profiles 테이블 INSERT 중...")
    # 기존 데이터 삭제
    supabase.table("instructor_profiles").delete().neq("id", 0).execute()

    records = []
    for file_key, name_kr in MAPPING.items():
        photo_url = uploaded.get(file_key)
        records.append({
            "name_kr":   name_kr,
            "file_key":  file_key,
            "photo_url": photo_url,
        })

    BATCH = 50
    for i in range(0, len(records), BATCH):
        supabase.table("instructor_profiles").insert(records[i:i+BATCH]).execute()

    print(f"  INSERT 완료: {len(records)}개")
    print("\n✅ 완료!")

if __name__ == "__main__":
    main()
