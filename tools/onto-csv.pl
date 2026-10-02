# 🧭 온톨로지 JSON → nodes.csv · edges.csv (v0.10.73)
#  정본은 data/ontology-seocho.json 하나다. 이 CSV 는 엑셀·그래프 도구(Neo4j 등)로 보려고 **뽑아낸 사본**이다 — 손으로 고치지 않는다.
#  JSON 을 고치면 다시 돌린다:  perl tools/onto-csv.pl
use strict; use warnings; use utf8; use JSON::PP;
my $IN = 'data/ontology-seocho.json';
local $/; open my $f, '<:raw', $IN or die "$IN"; my $J = JSON::PP->new->utf8->decode(<$f>); close $f;
my $JJ = JSON::PP->new->canonical;
sub v { my $x = shift; return '' unless defined $x; return $x unless ref $x; my $s = $JJ->encode($x); utf8::decode($s); $s }
sub csv { join(',', map { my $s = v($_); $s =~ /[",\n]/ ? '"' . ($s =~ s/"/""/gr) . '"' : $s } @_) . "\n" }
sub out { my ($file, $rows) = @_; open my $o, '>:raw', $file or die; print $o "\xEF\xBB\xBF"; for (@$rows) { my $s = csv(@$_); utf8::encode($s); print $o $s } close $o; print "$file ", scalar(@$rows) - 1, " rows\n" }
my %CLASS = (intersections => 'Intersection', segments => 'Segment', branches => 'Branch', detours => 'Detour', facilities => 'CauseFacility', measures => 'Measure');
my @N = (['id', 'class', 'name', 'alias', 'src', 'when', 'clock', 'valid', 'detail', 'quote', 'lat', 'lon', 'gameNode']);
for my $k (sort keys %{$J->{entities}}) { for my $e (@{$J->{entities}{$k}}) {
  my $src = $e->{src} // ($e->{sig} && $e->{sig}{src}) // ($e->{schedule} && $e->{schedule}{src}) // '';
  my $det = $e->{how} // ($e->{schedule} && $e->{schedule}{v}) // $e->{kind} // '';
  push @N, [$e->{id}, $CLASS{$k} // $k, $e->{name}, $e->{alias}, $src, '', $e->{clock} // ($e->{schedule} && $e->{schedule}{clock}), $e->{valid}, $det, $e->{quote}, $e->{lat}, $e->{lon}, $e->{game} && $e->{game}{node}]; } }
for my $e (@{$J->{causeTypes}}) { push @N, [$e->{id}, 'CauseType', $e->{name}, '', '', '', '', '', "$e->{trait} → $e->{response}", '', '', '', ''] }
for my $e (@{$J->{cases}}) { push @N, [$e->{id}, 'CongestionCase', $e->{story}, '', $e->{src}, $e->{when}, $e->{clock}, '', ($e->{result} // '') . ($e->{check} ? " · $e->{check}" : ''), $e->{quote}, '', '', ''] }
for my $e (@{$J->{scenarios}}) { push @N, [$e->{id}, 'Scenario', $e->{name} // $e->{title} // '', '', $e->{src} // '', '', '', '', $e->{lesson} // '', '', '', '', ''] }
my @E = (['source', 'relation', 'target', 'when', 'src', 'note', 'check', 'quote']);
for my $r (@{$J->{relations}}) { my $m = $r->[3] || {}; push @E, [$r->[0], $r->[1], $r->[2], $m->{when}, $m->{src}, $m->{note}, $m->{check}, $m->{quote}] }
# 사례의 원인·자리·조치도 선으로(사례 칸에 있는 연결)
for my $e (@{$J->{cases}}) {
  push @E, [$e->{id}, 'causedBy', $e->{cause}, '', $e->{src}, '사례 칸에서 뽑음', '', ''] if $e->{cause} && !grep { $_->[0] eq $e->{id} && $_->[1] eq 'causedBy' } @{$J->{relations}};
  push @E, [$e->{id}, 'observedAt', $e->{at}, '', $e->{src}, '사례 칸에서 뽑음', '', ''] if $e->{at} && !grep { $_->[0] eq $e->{id} && $_->[1] eq 'observedAt' } @{$J->{relations}}; }
out('data/ontology-seocho-nodes.csv', \@N); out('data/ontology-seocho-edges.csv', \@E);
