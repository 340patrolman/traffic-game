use JSON::PP; binmode STDOUT,":utf8"; my @a;
for my $p (1..41){ local $/; open F,"<:raw","st/p$p.json" or next; my $j=eval{JSON::PP->new->utf8->relaxed->decode(<F>)} or do{print "bad $p\n";next}; push @a,@{$j->{body}{items}||[]}; }
print "n=",scalar(@a),"\n"; my %L; $L{$_->{indsLclsNm}}++ for @a; print join(" · ",map{"$_ $L{$_}"}sort{$L{$b}<=>$L{$a}}keys %L),"\n";
my %M; $M{$_->{indsMclsNm}}++ for grep{$_->{indsLclsNm}=~/음식|숙박|예술|오락|소매/}@a; print join(" · ",map{"$_ $M{$_}"}sort{$M{$b}<=>$M{$a}}keys %M),"\n";
my %S; $S{$_->{indsSclsNm}}++ for grep{$_->{indsMclsNm}=~/주점|숙박|유원지|오락|게임|노래/}@a; print join(" · ",map{"$_ $S{$_}"}sort{$S{$b}<=>$S{$a}}keys %S),"\n";
my %u; my $d=grep{$u{$_->{bizesId}}++}@a; print "dup=$d\n";
