use utf8; use open qw(:std :utf8); use JSON::PP;
my $S=shift;
open my $t,'<:utf8',"$S/onto/a008_seocho.tsv" or die; my $h=<$t>; my @it; my %by;
while(<$t>){ chomp; my @c=split /\t/; next unless $c[5] eq '340' || $c[5] eq '380'; my $r={c=>0+$c[0],n=>$c[1],p=>0+$c[3],pe=>0+$c[5],la=>0+$c[7],lo=>0+$c[8]}; push @it,$r; $by{$r->{c}}=$r; }
open my $x,'<:utf8','C:/Users/knpth/Desktop/지식베이스/07_API키/신호앱/data/cits_cross_2779_20260910.txt' or die; my @cits;
while(<$x>){ chomp; my ($no,$nm,$la,$lo)=split /\|/; push @cits,[$no,$nm,$la,$lo] if $la>37.42 && $la<37.53 && $lo>126.96 && $lo<127.08; }
my ($nc,$np,$miss)=(0,0,0);
for my $r (@it){ my ($bd,$bn)=(1e9,'');
  for my $c (@cits){ my $d=sqrt((($c->[3]-$r->{lo})*88800)**2+(($c->[2]-$r->{la})*111000)**2); if($d<$bd){$bd=$d;$bn=$c->[0]; $r->{cn}=$c->[1];} }
  if($bd<=15){ $r->{cits}=0+$bn; $nc++; } delete $r->{cn};
  if($r->{p}){ $np++; $miss++ unless $by{$r->{p}}; } }
printf "items %d · C-ITS 15m %d · 연등 %d (부모 없음 %d)\n", scalar(@it),$nc,$np,$miss;
my $d={schema=>'tg-tgis/1',area=>'서울 서초구 — 서울서초경찰서(340)·서울방배경찰서(380) 관할 신호 교차로',
  source=>'서울시 T-GIS 교통안전시설물 「교차로(A008_P)」(교통운영과 테이블 정의서 · 공공데이터포털 공개자료 — 소유자 2026-10-02 받음 · EPSG:5186 → WGS84)',
  fields=>'c = 교차로코드(CSS_NUM) · n = 명칭 · la·lo = 위경도 · p = 연동교차로코드(LK_CS_CDE — 그 신호가 딸려 도는 부모 교차로 · 0 = 없음 · 실측 서초·방배 87곳 중 70곳이 「(연등)」 이름이고 나머지 17곳도 100~320m 이웃 교차로를 가리킨다 · 자기 자신을 가리키는 1곳은 무시) · pe = 관할 경찰서 코드(340 서초서 · 380 방배서) · cits = 서울 C-ITS 교차로 번호(15m 안에 같은 신호가 있을 때)',
  note=>'전기 고객번호·계량기번호 칸은 옮기지 않았다. 신호 현시·주기는 이 표에 없다(교통과 현시도는 비공개 — 넣지 않음).',
  items=>[map { my $r=$_; [ $r->{c}, $r->{n}, 0+sprintf('%.6f',$r->{la}), 0+sprintf('%.6f',$r->{lo}), $r->{p}, $r->{pe}, $r->{cits}||0 ] } sort { $a->{c} <=> $b->{c} } @it]};
open my $o,'>:raw','C:/Users/knpth/Desktop/지식베이스/traffic-game/data/tgis-seocho.json'; print $o JSON::PP->new->utf8->canonical->encode($d); close $o;
