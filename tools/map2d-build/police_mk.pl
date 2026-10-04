use utf8; use open qw(:std :utf8);
open my $f,'<:utf8',"jigudae_u8.csv" or die; my @rows;
while(<$f>){ chomp; s/\r//; next if $.==1; my @c; while(/\G(?:"([^"]*)"|([^,]*))(?:,|$)/g){ push @c, defined $1?$1:$2; last if pos($_)>=length($_);} 
  next unless $c[1] eq '서울청' && $c[2] =~ /^서울(서초|방배|강남|수서|동작|관악)$/;
  my $a=$c[5]; $a=~s/\s+/ /g; $a=~s/^서울(특별시)? (\S+구) //; my $gu=$2; $a=~s/[,(].*$//; $a=~s/ (\S+지구대|\S+파출소)$//;
  $a=~s/(\S+?[로길])\s*(\d+[가-힣]?길)/$1$2/;  # 효령로 31길 → 효령로31길
  my ($st,$no)= $a=~/^(\S*[로길])\s*(\d+(?:-\d+)?)/ or do { print STDERR "skip $a\n"; next };
  push @rows,[$c[2],$c[3],$c[4],$gu,$st,$no,$c[5]];
}
open my $o,'>:utf8',"cand.tsv"; print $o join("\t",@$_),"\n" for @rows;
my $q="[out:json][timeout:60];(\n"; my %seen;
for (@rows){ my $k="$_->[4]|$_->[5]"; next if $seen{$k}++; $q.=qq{ nwr["addr:street"="$_->[4]"]["addr:housenumber"="$_->[5]"](37.40,126.93,37.55,127.10);\n}; }
$q.=");\nout center tags;\n"; open my $qq,'>:utf8',"q.txt"; print $qq $q; print scalar(@rows)," rows\n";
