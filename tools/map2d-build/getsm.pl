# 사용: perl get.pl <출력파일> <URL — serviceKey 자리에 {KEY}>   (키는 화면에 찍지 않는다)
use strict; use JSON::PP;
my $s; { local $/; open my $f,'<:raw','C:/Users/knpth/Desktop/지식베이스/07_API키/keys.json' or die "keys"; $s=<$f>; }
$s=~s/^\xEF\xBB\xBF//;
my $k=JSON::PP->new->utf8->decode($s)->{safemap} or die "no key";
my ($out,$url)=@ARGV; $url=~s/\{KEY\}/$k/;
my $rc=system('curl','-s','-L','-m','120','-A','SeoulPatrolGame-dev/1.0','-o',$out,$url); my $sz=-s $out||0;
my $b=''; if (open my $h,'<:raw',$out) { local $/; $b=<$h>; close $h; }
$b=substr($b,0,300); $b=~s/\Q$k\E/<KEY>/g; print "rc=$rc size=$sz head=$b\n";
