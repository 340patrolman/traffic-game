use utf8; use open qw(:std :utf8); use JSON::PP;
my %G=( '요리 주점'=>'bar','생맥주 전문'=>'bar','일반 유흥 주점'=>'bar','무도 유흥 주점'=>'bar',
        '노래방'=>'play','PC방'=>'play','전자 게임장'=>'play','기타 오락장'=>'play','비디오방'=>'play',
        '여관/모텔'=>'inn','호텔/리조트'=>'inn','펜션'=>'inn','편의점'=>'conv' );
open my $f,'<:utf8','st.tsv'; my (@pts,%sub,@subL,%dong,@dongL,%agg);
while(<$f>){ chomp; my ($nm,$br,$L,$M,$Sm,$dg,$la,$lo,$adr,$fl)=split /\t/;
  $agg{$dg}{all}++; $agg{$dg}{food}++ if $L eq '음식'; my $g=$G{$Sm}; $agg{$dg}{$g}++ if $g;
  next unless $g && $la && $lo;
  $sub{$Sm}//=do{push @subL,$Sm; $#subL}; $dong{$dg}//=do{push @dongL,$dg; $#dongL};
  push @pts,[$nm.($br?" $br":''),0+sprintf("%.5f",$la),0+sprintf("%.5f",$lo),$sub{$Sm},$dong{$dg},$fl//''];
}
my %gOf=map{$_=>$G{$_}}@subL;
my $d={schema=>'tg-stores/1',
 source=>'소상공인시장진흥공단 상가(상권)정보 API(공공데이터포털 · 행정동별 상가업소 · 서초구 40,115곳 · 2026-09-28 받음) — 영업 여부·영업시간은 담지 않는다(등록 정보)',
 note=>'밤 순찰·주취 신고 동선 참고용 — 주점·노래방·PC방·숙박·편의점만 점으로 담고, 동마다 갈래별 개수를 둔다. 업소 이름은 등록 상호 그대로',
 sub=>\@subL, group=>\%gOf, dong=>\@dongL, pts=>\@pts, agg=>\%agg};
open my $o,'>:raw','C:/Users/knpth/Desktop/지식베이스/traffic-game/data/stores-seocho.json'; print $o JSON::PP->new->utf8->canonical->encode($d); close $o;
my %c; $c{$G{$subL[$_->[3]]}}++ for @pts; print scalar(@pts)," pts ",join(",",map{"$_ $c{$_}"}sort keys %c)," dongs ",scalar(@dongL),"\n";
