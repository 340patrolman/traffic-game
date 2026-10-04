use utf8; use open qw(:std :utf8);
open my $f,'<:utf8','st.tsv'; my (%M,%Sc);
while(<$f>){ chomp; my @c=split /\t/; $M{"$c[2] > $c[3]"}++; $Sc{"$c[3] > $c[4]"}++ if $c[2]=~/음식|숙박|예술|소매/; }
print "$_ $M{$_}\n" for grep { $M{$_}>=60 } sort { $M{$b}<=>$M{$a} } keys %M; print "---\n";
print "$_ $Sc{$_}\n" for grep { /주점|숙박|여관|모텔|노래|PC|게임|편의점|오락|호텔/ } sort { $Sc{$b}<=>$Sc{$a} } keys %Sc;
