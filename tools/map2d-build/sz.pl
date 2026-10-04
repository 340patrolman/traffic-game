use utf8; use open qw(:std :utf8); use JSON::PP;
sub rj { local $/; open my $f,"<:raw",$_[0] or return undef; JSON::PP->new->utf8->decode(<$f>) }
my @z; my %seen;
for my $fn ('cz_sc.json','cz_3220000.json','cz_3190000.json','cz_3200000.json'){ my $j=rj($fn) or next; my $it=$j->{body}{items}{item}||[];
  for (@$it){ my ($la,$lo)=(0+$_->{latitude},0+$_->{longitude}); next unless $la>37.42 && $la<37.53 && $lo>126.94 && $lo<127.09;
    my $k="$_->{trgetFcltyNm}|$la"; next if $seen{$k}++;
    push @z,{name=>$_->{trgetFcltyNm},kind=>$_->{fcltyKnd},lat=>0+sprintf("%.6f",$la),lon=>0+sprintf("%.6f",$lo),addr=>$_->{rdnmadr}||$_->{lnmadr},police=>$_->{cmptncPolcsttnNm},
      gu=>($_->{insttNm}=~/(\S+구)$/)[0]//'',cctv=>($_->{cctvYn} eq 'Y' ? ($_->{cctvNumber} ne '' ? 0+$_->{cctvNumber} : -1) : 0),rw=>$_->{prtcareaRw} ne '' ? 0+$_->{prtcareaRw} : undef,ref=>$_->{referenceDate}} } }
my @h; for my $y (2024,2025){ my $j=rj("scz_$y.json") or next; my $it=$j->{items}{item}; $it=[$it] if ref $it eq 'HASH';
  for (@{$it||[]}){ push @h,{name=>$_->{spot_nm},year=>$y,acc=>0+$_->{occrrnc_cnt},cas=>0+$_->{caslt_cnt},dead=>0+$_->{dth_dnv_cnt},ser=>0+$_->{se_dnv_cnt},sli=>0+($_->{sl_dnv_cnt}//0),lat=>0+sprintf("%.6f",$_->{la_crd}),lon=>0+sprintf("%.6f",$_->{lo_crd})} } }
my %gk; $gk{$_->{gu}}++ for @z;
my $d={schema=>'tg-schoolzone/1',
  source=>{zones=>'전국어린이보호구역표준데이터(행정안전부 공공데이터 표준 · 제공 각 자치구 · 공공데이터포털 15012891 · 오픈API 2026-09-28 받음) — 기준일은 항목마다(서초구 2026-05-08)',
           hot=>'한국도로교통공단 어린이보호구역내 어린이 교통사고 다발지역(공공데이터포털 · 오픈API 2026-09-28 · 서초구 2024·2025 공표분) — 출처 표시 의무'},
  note=>'보호구역 자리는 **대상 시설(학교·유치원·어린이집 등)의 점**이다 — 구역의 경계선(도로 구간)은 이 자료에 없다. 도로 폭은 m(보호구역도로폭 · 비어 있으면 모름)',
  count=>\%gk, zones=>\@z, hot=>\@h};
open my $o,'>:raw','C:/Users/knpth/Desktop/지식베이스/traffic-game/data/schoolzone-seocho.json'; print $o JSON::PP->new->utf8->canonical->encode($d); close $o;
print "zones ",scalar(@z)," ",join(",",map{"$_ $gk{$_}"}keys %gk)," hot ",scalar(@h),"\n";
