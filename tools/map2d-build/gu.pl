use utf8; use open qw(:std :utf8); use JSON::PP;
my %want=('11650'=>'서초구','11680'=>'강남구','11590'=>'동작구','11620'=>'관악구','41290'=>'과천시','41131'=>'성남시 수정구');
open my $f,'<:raw','C:/Users/knpth/Desktop/지식베이스/13_관할경계/원자료/hjd20260701.geojson' or die;
my %edges; my %pt; my $nf=0;
while (my $l=<$f>) { next unless $l=~/"sgg": "(\d+)"/ && $want{$1}; my $sg=$1; $l=~s/,\s*$//; my $ft=JSON::PP->new->utf8->decode($l); $nf++;
  my $g=$ft->{geometry}; my @polys = $g->{type} eq 'Polygon' ? ($g->{coordinates}) : @{$g->{coordinates}};
  for my $poly (@polys) { for my $ring (@$poly) { for my $i (0..$#$ring-1) { my ($a,$b)=@$ring[$i,$i+1];
    my $ka=sprintf("%.7f,%.7f",@$a), $kb=sprintf("%.7f,%.7f",@$b); next if $ka eq $kb; $pt{$ka}=$a; $pt{$kb}=$b;
    my $k= $ka lt $kb ? "$ka|$kb" : "$kb|$ka"; $edges{$sg}{$k}{n}++; $edges{$sg}{$k}{d}="$ka|$kb"; } } } }
print "features $nf\n";
sub dp { my ($p,$eps)=@_; return $p if @$p<3; my ($a,$b)=($p->[0],$p->[-1]); my ($im,$dm)=(0,0);
  my $cx=cos(37.49*3.14159265/180);
  for my $i (1..$#$p-1){ my ($x,$y)=(($p->[$i][0]-$a->[0])*111320*$cx,($p->[$i][1]-$a->[1])*111000); my ($dx,$dy)=(($b->[0]-$a->[0])*111320*$cx,($b->[1]-$a->[1])*111000);
    my $L=sqrt($dx*$dx+$dy*$dy)||1e-9; my $d=abs($x*$dy-$y*$dx)/$L; if($d>$dm){$dm=$d;$im=$i} }
  return [$a,$b] if $dm<=$eps; my $l=dp([@$p[0..$im]],$eps); my $r=dp([@$p[$im..$#$p]],$eps); pop @$l; return [@$l,@$r]; }
my @out;
for my $sg (sort keys %want) { my %adj; my $E=$edges{$sg};
  for my $k (keys %$E){ next if $E->{$k}{n}>1; my ($a,$b)=split /\|/,$E->{$k}{d}; push @{$adj{$a}},$b; push @{$adj{$b}},$a; }
  my %used; my @rings;
  for my $s (keys %adj){ next unless @{$adj{$s}}; my @r=($s); my $cur=$s; my $prev='';
    while(1){ my ($nx)=grep { !$used{ ($cur lt $_ ? "$cur|$_" : "$_|$cur") } } @{$adj{$cur}}; last unless defined $nx; $used{ ($cur lt $nx ? "$cur|$nx" : "$nx|$cur") }=1; push @r,$nx; $cur=$nx; last if $nx eq $s; }
    push @rings,\@r if @r>10; }
  my @rr; for my $r (@rings){ my $pts=[map { [$pt{$_}[0],$pt{$_}[1]] } @$r]; # 닫힌 고리: 가운데서 둘로 나눠 DP
    my $m=int(@$pts/2); my $h1=dp([@$pts[0..$m]],2.5); my $h2=dp([@$pts[$m..$#$pts]],2.5); pop @$h1; my @s=(@$h1,@$h2);
    push @rr,[map { [0+sprintf("%.6f",$_->[0]),0+sprintf("%.6f",$_->[1])] } @s]; }
  @rr = sort { @$b <=> @$a } @rr;
  push @out,{name=>$want{$sg},code=>$sg,rings=>\@rr}; printf "%s rings=%d pts=%s\n",$want{$sg},scalar(@rr),join("/",map{scalar @$_}@rr); }
my $d={schema=>'tg-districts/3',area=>'서울 서초구와 이웃 시·구(강남·동작·관악 · 과천시 · 성남시 수정구 — v0.10.82)',coords=>'wgs84 [lon, lat]',
  source=>'통계청 SGIS 행정동 경계(가공 vuski/admdongkor ver20260701 · 공공누리 1유형) — 행정동을 자치구별로 합쳐 바깥 테두리만 남김(v0.10.65 · 행정동 층과 같은 원자료라 테두리가 맞는다) · 2.5m 단순화',
  note=>'테두리 표시용이고 측량 자료가 아니다. v0.10.64 까지는 통계청 2013 단순화판이라 2026 행정동 경계와 어긋났다(소유자 지적 2026-09-28).',
  districts=>\@out};
open my $o,'>:raw','C:/Users/knpth/Desktop/지식베이스/traffic-game/data/maps/seoul-districts.json'; print $o JSON::PP->new->utf8->canonical->encode($d); close $o;
