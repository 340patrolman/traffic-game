use utf8; use open qw(:std :utf8); use JSON::PP;
local $/; open my $f,'<:raw','out.json'; my $boxes=JSON::PP->new->utf8->decode(<$f>); close $f;
my @st=( ['서울서초경찰서',37.4957,127.0052,'02-3483-9365','서초구'], ['서울방배경찰서',37.4818,126.9828,'02-525-5996','서초구'],
         ['서울강남경찰서',37.5087,127.0671,'02-3497-3041','강남구'], ['서울수서경찰서',37.4935,127.0771,'02-2155-9031','강남구'],
         ['서울동작경찰서',37.5128,126.9425,'02-811-9030','동작구'], ['서울관악경찰서',37.4742,126.9519,'02-870-0351','관악구'] );
my %LOC=('osm-addr'=>'OSM 관서(같은 도로명주소)','osm-name'=>'OSM 관서(이름 일치)');
for my $b (@$boxes){ my $l=$b->{loc};
  if($l=~/^interp:(.*)/){ $b->{locNote}="위치 근사 — OSM 같은 길 건물번호 $1를 이어 잡음(±수십 m)"; $b->{approx}=JSON::PP::true; }
  elsif($l=~/^near:(.*)/){ $b->{locNote}="위치 근사 — 같은 주소의 OSM 표시 「$1」 자리"; $b->{approx}=JSON::PP::true; }
  else { $b->{locNote}=$LOC{$l}; $b->{approx}=JSON::PP::false; }
  $b->{station}=~s/^서울(.*)$/서울$1경찰서/; delete $b->{loc}; }
my $d={ schema=>'tg-police/1',
  title=>'서초 부근 경찰 관서(공식 목록)',
  source=>{ boxes=>'경찰청_전국 지구대 파출소 주소 현황_20251231 · 공공데이터포털(data.go.kr/data/15077036) · 경찰청 범죄예방대응국 지역경찰운영과 · 이용허락범위 제한 없음 · 2025년 말 기준 · 받은 날 2026-09-28',
            stations=>'경찰서 청사 위치·대표번호 — 경찰민원24(2026-09-09, T-Book PS_PTS 와 같은 값)',
            loc=>'지구대·파출소 자리 — 공식 목록은 주소만 있다. OpenStreetMap(ODbL, Overpass 2026-09-28)의 같은 도로명주소·같은 이름 관서로 잡고, 없으면 같은 길 건물번호 사이를 이어 잡았다(근사).' },
  area=>'서울서초·서울방배(서초구 전부) + 이웃 서울강남·서울수서·서울동작·서울관악 중 자리를 잡은 것',
  missing=>'이웃 경찰서 관서 중 16곳은 자리를 잡지 못해 넣지 않았다(서초구 관서는 11곳 모두 있음) · 치안센터는 이 목록에 없다(별도 자료)',
  stations=>[ map { {name=>$_->[0],lat=>$_->[1],lon=>$_->[2],tel=>$_->[3],gu=>$_->[4]} } @st ],
  boxes=>$boxes };
open my $o,'>:raw','C:/Users/knpth/Desktop/지식베이스/traffic-game/data/police-seocho.json'; print $o JSON::PP->new->utf8->canonical->encode($d); close $o;
print scalar(@$boxes)," boxes\n";
