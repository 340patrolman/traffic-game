use utf8; use open qw(:std :utf8); use JSON::PP;
# 경찰청_전국 지구대 파출소 주소 현황_20251231(공공데이터포털 15077036) 서초 부근 행 → 자리 잡기
#  ① OSM 주소(addr:street+housenumber)가 같은 관서 ② OSM 경찰 관서 이름이 같은 것 ③ 같은 길 건물번호 사이를 이어 잡음(근사)
sub rj { local $/; open my $f,"<:raw",$_[0]; my $j=JSON::PP->new->utf8->decode(<$f>); $j }
my @osm;
for my $fn ('res2.json','res.json') {
  for my $e (@{rj($fn)->{elements}}) {
    my $t=$e->{tags}; my ($la,$lo)=$e->{lat}?($e->{lat},$e->{lon}):($e->{center}{lat},$e->{center}{lon});
    push @osm,{name=>$t->{name}//'',am=>$t->{amenity}//'',st=>$t->{"addr:street"}//'',no=>$t->{"addr:housenumber"}//'',la=>$la,lo=>$lo,type=>$e->{type}};
  }
}
my %interp=( '서초2'=>[37.48767,127.02910,'서운로 22~62번 사이'], '서초3'=>[37.49202,127.01082,'반포대로30길 18~42번 사이'],
             '서초'=>[37.48533,127.01670,'효령로 289~303번 사이'], '이수'=>[37.49376,126.98858,'동광로19길 19~51번 사이'],
             '방배1'=>[37.48392,126.99532,'효령로31길 58~68번 사이'] );
sub okName { my ($o,$full)=@_; return 0 unless $o->{am} eq 'police' || $o->{am} eq 'government' || $o->{am} eq '';
  return 0 if index($o->{name},'정자')>=0 || index($o->{name},'앞')>=0 || index($o->{name},'방향')>=0 || index($o->{name},'.')>=0;
  return index($o->{name},$full)>=0; }
open my $f,'<:utf8','cand.tsv'; my @out; my @miss;
while (<$f>) {
  chomp; my ($ps,$nm,$kind,$gu,$st,$no,$addr)=split /\t/; my $full=$nm.$kind; my ($hit,$how);
  my @byAddr=grep { $_->{st} eq $st && $_->{no} eq $no && ($_->{am} eq 'police' || index($_->{name},$full)>=0) } @osm;
  my @byName=grep { okName($_,$full) } @osm;
  if (@byAddr) { $hit=$byAddr[0]; $how=$hit->{am} eq 'police' ? 'osm-addr' : 'near:'.$hit->{name}; }
  elsif (@byName) {
    @byName=sort { ($b->{type} eq 'way') <=> ($a->{type} eq 'way') || ($b->{am} eq 'police') <=> ($a->{am} eq 'police') } @byName;
    if ($full eq '남성지구대') { @byName=grep { $_->{la}<37.49 } @byName; }   # 사당로17나길(남성역 쪽) — 다른 한 점은 1.5km 북쪽
    $hit=$byName[0]; $how='osm-name';
  }
  elsif ($interp{$nm} && ($ps eq '서울서초' || $ps eq '서울방배')) { my $i=$interp{$nm}; $hit={la=>$i->[0],lo=>$i->[1]}; $how='interp:'.$i->[2]; }
  if (!$hit) { push @miss,"$ps $full"; next; }
  $addr=~s/\s+/ /g;
  push @out,{station=>$ps,name=>$full,kind=>$kind,addr=>$addr,lat=>0+sprintf("%.5f",$hit->{la}),lon=>0+sprintf("%.5f",$hit->{lo}),loc=>$how};
}
printf "%-6s %-12s %.5f %.5f %s\n",$_->{station},$_->{name},$_->{lat},$_->{lon},$_->{loc} for @out; print "MISS: $_\n" for @miss;
open my $o,'>:raw','out.json'; print $o JSON::PP->new->utf8->canonical->encode(\@out);
