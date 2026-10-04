use utf8; use strict; use JSON::PP; use open qw(:std :utf8);
my $src = 'C:/Users/knpth/Desktop/지식베이스/13_관할경계/원자료/hjd20260701.geojson';
open my $h, '<:utf8', $src or die; my (@sc, @nb);
while (my $l = <$h>) {
  next unless $l =~ /"sgg": "(11650|11680|11590|11620)"/; my $g = $1;
  $l =~ s/,\s*$//; my $f = eval { JSON::PP->new->decode($l) } or next;
  if ($g eq '11650') { push @sc, $f } else { push @nb, $f }
}
sub dp { my ($p, $t) = @_; return $p if @$p < 4; my ($a, $b) = ($p->[0], $p->[-1]); my ($mi, $md) = (0, 0);
  for my $i (1 .. $#$p - 1) { my $q = $p->[$i]; my ($dx, $dy) = ($b->[0] - $a->[0], $b->[1] - $a->[1]); my $L = sqrt($dx*$dx + $dy*$dy) || 1e-12;
    my $d = abs(($q->[0] - $a->[0]) * $dy - ($q->[1] - $a->[1]) * $dx) / $L; if ($d > $md) { $md = $d; $mi = $i } }
  return [$a, $b] if $md <= $t; my $l1 = dp([@$p[0 .. $mi]], $t); my $l2 = dp([@$p[$mi .. $#$p]], $t); pop @$l1; return [@$l1, @$l2] }
my @sv; for my $f (@sc) { for my $P (@{$f->{geometry}{coordinates}}) { for my $q (@{$P->[0]}) { push @sv, $q } } }
my $KX = 88800, my $KY = 111000;
sub near { my ($f) = @_; for my $P (@{$f->{geometry}{coordinates}}) { for my $q (@{$P->[0]}) { for (my $k = 0; $k < @sv; $k += 3) { my $s = $sv[$k];
  my $dx = ($q->[0] - $s->[0]) * $KX, my $dy = ($q->[1] - $s->[1]) * $KY; return 1 if $dx*$dx + $dy*$dy < 1500*1500 } } } 0 }
my @out; my $pts = 0;
for my $f (@nb) { next unless near($f); my $p = $f->{properties}; (my $nm = $p->{adm_nm}) =~ s/^\S+ \S+ //;
  my @polys; for my $P (@{$f->{geometry}{coordinates}}) { my @rs; for my $r (@$P) { my $m = int(@$r / 2); my $s1 = dp([@$r[0 .. $m]], 0.00006); my $s2 = dp([@$r[$m .. $#$r]], 0.00006); pop @$s1; my $s = [@$s1, @$s2]; next if @$s < 4; push @rs, [map { [0 + sprintf('%.6f', $_->[0]), 0 + sprintf('%.6f', $_->[1])] } @$s]; $pts += @$s } push @polys, \@rs if @rs }
  push @out, { gu => $p->{sggnm}, name => $nm, code => $p->{adm_cd2}, polys => \@polys } }
@out = sort { $a->{gu} cmp $b->{gu} || $a->{name} cmp $b->{name} } @out;
my $o = { schema => 'tg-dong-near/1', area => '서울 서초구와 맞닿은 강남구·동작구·관악구 행정동(서초구 경계에서 1.5km 안)',
  source => '통계청 통계지리정보서비스(SGIS) 행정동 경계를 가공한 vuski/admdongkor(HangJeongDong_ver20260701) — 공공누리 제1유형(출처 표시). dong-seocho.json 과 같은 원자료.',
  asOf => '2026-07-01', crs => 'WGS84 [lon, lat]', method => 'Douglas-Peucker 0.00006° 단순화 · 서초구 경계 꼭짓점에서 1.5km 안에 꼭짓점이 있는 동만',
  use => '표시용 — 이 동들은 경계와 이름만 담는다(인구·사고 등 자세한 자료는 서초구만 있다)', dong => \@out };
open my $w, '>:utf8', 'C:/Users/knpth/Desktop/지식베이스/traffic-game/data/dong-near.json'; print $w JSON::PP->new->canonical->encode($o); close $w;
print scalar(@out), " dongs, $pts pts\n"; my %g; $g{$_->{gu}}++ for @out; print join(' ', map { "$_:$g{$_}" } sort keys %g), "\n"; print join(' ', map { $_->{name} } @out), "\n";
