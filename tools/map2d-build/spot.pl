use utf8; use open qw(:std :utf8); use JSON::PP;
local $/; open my $a,'<:utf8','C:/Users/knpth/Desktop/지식베이스/11_길목/분석/app_data2.js' or die; my $s=<$a>; close $a;
sub jv { my $n=shift; $s=~/^var $n=(.*?);?\s*$/m or die "no $n"; return JSON::PP->new->decode($1); }
my $BUS=jv('BUS'); my $SUB=jv('SUB'); my $SPOT=jv('SPOT'); my ($ym)=$s=~/CARD_YM="([^"]+)"/; my ($ty)=$s=~/TAAS_Y="([^"]+)"/;
open my $p,'<:raw','data/pubdata-seocho.json' or die; my $pj=JSON::PP->new->utf8->decode(<$p>); my %sl; $sl{$_->{name}}=$_ for @{$pj->{subway}{items}};
my $D=30;   # 2026년 6월 = 30일 — 월 합계를 하루 평균으로
my @st; my $miss=0;
for my $b (@$BUS){ my ($nm,$la,$lo,$tot,$h)=@$b; push @st,{t=>'b',n=>$nm,la=>0+$la,lo=>0+$lo,h=>[map { 0+sprintf('%.0f',$_/$D) } @$h]}; }
for my $b (@$SUB){ my ($nm,$k,$tot,$h)=@$b; my $q=$sl{$nm}; unless($q){ $miss++; print "역 좌표 없음 $nm\n"; next; } push @st,{t=>'s',n=>$nm.'역',la=>0+$q->{lat},lo=>0+$q->{lon},g=>$k,h=>[map { 0+sprintf('%.0f',$_/$D) } @$h]}; }
my @sp=map { my ($ty2,$nm,$dong,$n,$cas,$dth,$la,$lo,$yrs,$yl)=@$_; {k=>$ty2,n=>$nm,la=>0+$la,lo=>0+$lo,yrs=>0+$yrs,y=>$yl,c=>0+$n,cs=>0+$cas,d=>0+$dth} } @$SPOT;
printf "버스 %d · 역 %d(좌표 없음 %d) · 다발지 %d\n", scalar(@$BUS), scalar(@$SUB)-$miss, $miss, scalar(@sp);
my $d={schema=>'tg-spot/1',area=>'서울 서초구 — T-Book 길목(tbook-spot v0.2) 자료',
  source=>"서울시 교통카드 정류장·역별 시간대 하차($ym · 노선 합산) · TAAS 사고다발지($ty · 200m 안 한 자리로 묶고 가장 최근 선정값 — 연도 중복 제거)",
  method=>'h = 그 달 시간대별 하차 합계 ÷ 30일(하루 평균 하차) — 추정이 아니라 교통카드 실적이다. 역 좌표는 이 게임 pubdata(서울시 지하철 승하차) 역 좌표. 다발지는 1년 전 자료·연 1회 갱신이라 참고.',
  note=>'「0건」은 사고 없음이 아니다(다발지는 상위 목록). 공휴일을 가리지 않는다. 술자리(주점 결제)는 볼 수 없다.',
  stops=>\@st, spots=>\@sp};
open my $o,'>:raw','data/spot-seocho.json'; print $o JSON::PP->new->utf8->canonical->encode($d); close $o;
