use utf8; use open qw(:std :utf8); use JSON::PP;
local $/; open F,"<:raw","res3.json"; my $j=JSON::PP->new->utf8->decode(<F>); close F;
my %c; for my $e (@{$j->{elements}}){ my $t=$e->{tags}; my ($la,$lo)=$e->{lat}?($e->{lat},$e->{lon}):($e->{center}{lat},$e->{center}{lon});
  my ($n)= ($t->{"addr:housenumber"}//'')=~/^(\d+)/ or next; next if $t->{"addr:housenumber"}=~/^\d+-/ ; push @{$c{$t->{"addr:street"}}},[$n,$la,$lo]; }
my @want=(['서초2','서운로',38],['서초3','반포대로30길',40],['서초','효령로',297],['이수','동광로19길',38],['방배1','효령로31길',64]);
for my $w (@want){ my ($nm,$st,$no)=@$w; my @a=grep { defined } @{$c{$st}||[]};
  my %u; @a = grep { !$u{$_->[0]}++ } sort { $a->[0]<=>$b->[0] } @a;
  my @par=grep { $_->[0]%2==$no%2 } @a; my @use=@par>=2?@par:@a;
  my ($lo,$hi); for (@use){ $lo=$_ if $_->[0]<=$no; $hi//=$_ if $_->[0]>=$no; }
  my ($la,$lg,$how);
  if($lo&&$hi&&$lo->[0]!=$hi->[0]){ my $f=($no-$lo->[0])/($hi->[0]-$lo->[0]); $la=$lo->[1]+$f*($hi->[1]-$lo->[1]); $lg=$lo->[2]+$f*($hi->[2]-$lo->[2]); $how="between $lo->[0]~$hi->[0] gap ".sprintf("%.0f",(abs($hi->[1]-$lo->[1])*111000**2+0)**0 * sqrt((($hi->[1]-$lo->[1])*111000)**2+(($hi->[2]-$lo->[2])*88800)**2))."m"; }
  else { my $p=$lo||$hi; ($la,$lg)=($p->[1],$p->[2]); $how="nearest $p->[0]"; }
  printf "%s %s %d -> %.5f %.5f (%s) [%d pts: %s]\n",$nm,$st,$no,$la,$lg,$how,scalar(@a),join(",",map{$_->[0]}@a); }
