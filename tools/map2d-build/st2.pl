use utf8; use open qw(:std :utf8); use JSON::PP;
open my $o,'>:utf8','st.tsv';
for my $p (1..41){ local $/; open F,"<:raw","st/p$p.json" or next; my $raw=<F>; close F;
  my $j=JSON::PP->new->utf8->relaxed->decode($raw);
  for (@{$j->{body}{items}||[]}){ print $o join("\t", map { my $v=$_//''; $v=~s/[\t\n]/ /g; $v } @$_{qw(bizesNm brchNm indsLclsNm indsMclsNm indsSclsNm adongNm lat lon rdnmAdr flrNo)}),"\n"; } }
close $o; print "done\n";
