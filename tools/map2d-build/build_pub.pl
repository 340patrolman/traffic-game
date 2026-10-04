use utf8; use strict; use warnings; use JSON::PP; use open qw(:std :utf8);
# 데이터 압축지도용 공공데이터 묶음 — data/pubdata-seocho.json
my $K = 'C:/Users/knpth/Desktop/지식베이스';
my $O = "$K/07_API키/out";
my $S = $ARGV[0];
sub rdj { my ($f) = @_; local $/; open my $h, '<:raw', $f or die "$f"; my $s = <$h>; $s =~ s/^\xEF\xBB\xBF//; JSON::PP->new->utf8->decode($s) }
sub r6 { 0 + sprintf('%.6f', $_[0]) }
my %out = (schema => 'tg-pubdata/1', area => '서울 서초구(와 맞닿은 둘레)', built => '2026-09-28', note => '게임은 통신 0 — 받은 날의 값을 구워 둔 파일이다. 층마다 출처·기준일·한계를 적는다.');

# ① 생활인구(서울시 · 행정동 · 시간대) — lp.txt 는 이 도구가 원자료에서 뽑은 평균
my $dg = rdj("$K/traffic-game/data/dong-seocho.json"); my %nm; $nm{substr($_->{code}, 0, 8)} = $_->{name} for @{$dg->{dong}};
open my $h, '<:utf8', "$S/lp.txt" or die; my %lp;
while (<$h>) { chomp; my ($c, $wd, $we) = /^(\d+) wd:([\d,]+) we:([\d,]+)/ or next; next unless $nm{$c}; $lp{$nm{$c}} = { wd => [map { 0 + $_ } split /,/, $wd], we => [map { 0 + $_ } split /,/, $we] } }
$out{livepop} = { source => '서울시 생활인구(행정동 단위 · LOCAL_PEOPLE_DONG) 2026년 7월 31일치 — 평일·주말 시간대별 평균(명). KT 통신 자료로 추정한 「그 시각 그 동에 있는 사람 수」(주민등록 인구와 다르다)', month => '2026-07', dong => \%lp };

# ② 음주운전 사고 다발지(도로교통공단)
my $dr = rdj("$O/koroad_drunk.json"); my @dr;
for my $x (@$dr) { next unless $x->{la_crd} && defined $x->{occrrnc_cnt}; my $g = eval { JSON::PP->new->decode($x->{geom_json}) }; my $ring = $g ? $g->{coordinates}[0] : [];
  push @dr, { name => $x->{spot_nm}, year => (($x->{afos_id} // '') =~ /^(\d{4})/ ? 0 + $1 : undef), acc => 0 + $x->{occrrnc_cnt}, caslt => 0 + $x->{caslt_cnt}, dead => 0 + $x->{dth_dnv_cnt}, ser => 0 + $x->{se_dnv_cnt}, sli => 0 + $x->{sl_dnv_cnt},
    lat => r6($x->{la_crd}), lon => r6($x->{lo_crd}), ring => [map { [r6($_->[0]), r6($_->[1])] } @$ring] } }
$out{drunk} = { source => '도로교통공단 교통사고정보 개방시스템 — 음주운전 사고다발지(frequentzone/drunkdrive) · 서초구', items => \@dr };

# ③ 사고위험지역(도로교통공단 · UTM-K → WGS84)
sub utmk2ll { # EPSG:5179 역변환(GRS80 · TM · 원점 38N 127.5E · k0 0.9996 · FE 1,000,000 · FN 2,000,000)
  my ($E, $N) = @_; my $a = 6378137; my $f = 1 / 298.257222101; my $e2 = 2 * $f - $f * $f; my $k0 = 0.9996; my $lat0 = 38 * 3.14159265358979 / 180; my $lon0 = 127.5 * 3.14159265358979 / 180;
  my $M = sub { my $p = shift; $a * ((1 - $e2 / 4 - 3 * $e2**2 / 64 - 5 * $e2**3 / 256) * $p - (3 * $e2 / 8 + 3 * $e2**2 / 32 + 45 * $e2**3 / 1024) * sin(2 * $p) + (15 * $e2**2 / 256 + 45 * $e2**3 / 1024) * sin(4 * $p) - (35 * $e2**3 / 3072) * sin(6 * $p)) };
  my $m = $M->($lat0) + ($N - 2000000) / $k0; my $mu = $m / ($a * (1 - $e2 / 4 - 3 * $e2**2 / 64 - 5 * $e2**3 / 256)); my $e1 = (1 - sqrt(1 - $e2)) / (1 + sqrt(1 - $e2));
  my $p1 = $mu + (3 * $e1 / 2 - 27 * $e1**3 / 32) * sin(2 * $mu) + (21 * $e1**2 / 16 - 55 * $e1**4 / 32) * sin(4 * $mu) + (151 * $e1**3 / 96) * sin(6 * $mu) + (1097 * $e1**4 / 512) * sin(8 * $mu);
  my $ep2 = $e2 / (1 - $e2); my $C1 = $ep2 * cos($p1)**2; my $T1 = (sin($p1) / cos($p1))**2; my $N1 = $a / sqrt(1 - $e2 * sin($p1)**2); my $R1 = $a * (1 - $e2) / (1 - $e2 * sin($p1)**2)**1.5; my $D = ($E - 1000000) / ($N1 * $k0);
  my $lat = $p1 - ($N1 * sin($p1) / cos($p1) / $R1) * ($D**2 / 2 - (5 + 3 * $T1 + 10 * $C1 - 4 * $C1**2 - 9 * $ep2) * $D**4 / 24 + (61 + 90 * $T1 + 298 * $C1 + 45 * $T1**2 - 252 * $ep2 - 3 * $C1**2) * $D**6 / 720);
  my $lon = $lon0 + ($D - (1 + 2 * $T1 + $C1) * $D**3 / 6 + (5 - 2 * $C1 + 28 * $T1 - 3 * $C1**2 + 8 * $ep2 + 24 * $T1**2) * $D**5 / 120) / cos($p1);
  return (r6($lon * 180 / 3.14159265358979), r6($lat * 180 / 3.14159265358979)) }
my $rk = rdj("$O/koroad_riskArea.json"); my @rk;
for my $x (@$rk) { my @pt; my ($body) = $x->{geom_wkt} =~ /\(\((.*?)\)/; for my $p (split /,/, $body // '') { my ($e, $n) = split ' ', $p; push @pt, [utmk2ll($e, $n)] }
  my @c = utmk2ll($x->{cntpnt_utmk_x_crd}, $x->{cntpnt_utmk_y_crd});
  push @rk, { name => $x->{acc_risk_area_nm}, cause => $x->{cause_anals_ty_nm}, cause2 => $x->{str_cause_anals_ty_nm}, acc => 0 + $x->{tot_acc_cnt}, dead => 0 + $x->{tot_dth_dnv_cnt}, ser => 0 + $x->{tot_se_dnv_cnt}, sli => 0 + $x->{tot_sl_dnv_cnt}, lon => $c[0], lat => $c[1], ring => \@pt } }
$out{risk} = { source => '도로교통공단 — 사고위험지역(반경 50m 안 사고가 몰린 곳) · 좌표 UTM-K(EPSG:5179)를 WGS84 로 바꿈', items => \@rk };

# ④ 지하철 역별 승하차(서울시 · 2026년 6월) + 역 자리(OSM)
my %st; open $h, '<:utf8', "$S/stations.txt"; while (<$h>) { chomp; my ($n, $la, $lo) = split /\|/; $st{$n} = [$la, $lo] } close $h;
my (%sub, %days);
open $h, "<:encoding(UTF-8)", "$O/CARD_SUBWAY_MONTH_202606.csv"; <$h>;
while (my $l = <$h>) { $l =~ s/"//g; my ($d, $line, $name, $on, $off) = split /,/, $l; next unless $name;
  (my $base = $name) =~ s/\(.*//; $base = '이수' if $name =~ /이수/; my $c = $st{$base} or next;
  next unless $c->[0] > 37.445 && $c->[0] < 37.53 && $c->[1] > 126.975 && $c->[1] < 127.06;
  $sub{$base}{on} += $on; $sub{$base}{off} += $off; $sub{$base}{lines}{$line} = 1; $days{$d} = 1 }
close $h; my $nd = scalar(keys %days) || 30;
$out{subway} = { source => '서울시 지하철 호선별 역별 승하차 인원(CARD_SUBWAY_MONTH · 2026년 6월 · 교통카드) — 하루 평균 · 역 자리는 OSM · 신분당선은 자료에 없다', days => $nd,
  items => [map { { name => $_, lines => [sort keys %{$sub{$_}{lines}}], on => int($sub{$_}{on} / $nd), off => int($sub{$_}{off} / $nd), lat => r6($st{$_}[0]), lon => r6($st{$_}[1]) } } sort keys %sub] };

# ⑤ 버스 정류장별 승하차(서울시 · 2026년 6월)
my $bs = rdj("$O/seoul_busstop_seocho.json"); my %stop;
for my $x (@$bs) { next unless $x->{YCRD} && $x->{XCRD}; next unless $x->{YCRD} > 37.44 && $x->{YCRD} < 37.535 && $x->{XCRD} > 126.97 && $x->{XCRD} < 127.07; $stop{$x->{STOPS_NO}} = { name => $x->{STOPS_NM}, lat => r6($x->{YCRD}), lon => r6($x->{XCRD}), h => [(0) x 24] } }
require Encode;
open $h, '<:raw', "$O/2026년_버스노선별_정류장별_시간대별_승하차_인원_정보(06월).csv" or die 'bus csv'; <$h>;
while (my $l = <$h>) { $l =~ s/"//g; my @f = split /,/, $l; my $s = $stop{$f[3]} or next; for my $hr (0 .. 23) { $s->{h}[$hr] += ($f[6 + 2 * $hr] || 0) + ($f[7 + 2 * $hr] || 0) } }
close $h;
my @stops; for my $k (keys %stop) { my $s = $stop{$k}; my $t = 0; $t += $_ for @{$s->{h}}; next unless $t > 0; my $pk = 0; for (0 .. 23) { $pk = $_ if $s->{h}[$_] > $s->{h}[$pk] }
  push @stops, { name => $s->{name}, id => $k, lat => $s->{lat}, lon => $s->{lon}, day => int($t / 30), peak => $pk, h => [map { int($_ / 30) } @{$s->{h}}] } }
@stops = sort { $b->{day} <=> $a->{day} } @stops;
$out{bus} = { source => '서울시 버스노선별 정류장별 시간대별 승하차 인원(2026년 6월 · 교통카드) — 하루 평균(승차+하차) · 정류장 자리는 서울시 버스정류소 위치', items => \@stops };

# ⑥ 시설(OSM)
my $of = rdj("$S/osm_fac.json"); my %cat = (police => '경찰', fire_station => '소방', hospital => '병원', clinic => '의원', pharmacy => '약국', school => '학교', kindergarten => '유치원·어린이집', childcare => '유치원·어린이집',
  toilets => '화장실', parking => '주차장', fuel => '주유소', charging_station => '전기차 충전', townhall => '관공서·주민센터', community_centre => '관공서·주민센터', social_facility => '복지시설', library => '도서관', post_office => '우체국', bank => '은행·ATM', atm => '은행·ATM',
  fire_hydrant => '소화전', defibrillator => '자동심장충격기', subway_entrance => '지하철 출입구', playground => '놀이터', park => '공원', convenience => '편의점');
my %fac;
for my $e (@{$of->{elements}}) { my $t = $e->{tags}; my $k = $t->{amenity} || $t->{emergency} || $t->{railway} || $t->{leisure} || $t->{shop} || ''; my $c = $cat{$k} or next;
  my $la = $e->{lat} // $e->{center}{lat}; my $lo = $e->{lon} // $e->{center}{lon}; next unless $la;
  my $o = { name => $t->{name} // '', lat => r6($la), lon => r6($lo) }; $o->{er} = 1 if ($t->{emergency} // '') eq 'yes'; $o->{ref} = $t->{ref} if $t->{ref} && $k eq 'subway_entrance';
  push @{$fac{$c}}, $o }
$out{fac} = { source => '© OpenStreetMap contributors (ODbL) · Overpass 2026-09-28 · 서초구 경계 안. 자원봉사로 채운 지도라 빠진 곳·이름이 틀린 곳이 있다(특히 경찰 관서 — 공식 목록 대조 전)', cats => \%fac };

# ⑦ 신호 교차로(서울 C-ITS · 공개)
open $h, '<:utf8', "$K/07_API키/신호앱/data/cits_cross_2779_20260910.txt"; my @sig;
while (<$h>) { chomp; my ($no, $n, $la, $lo) = split /\|/; next unless $la && $la > 37.44 && $la < 37.535 && $lo > 126.97 && $lo < 127.07; push @sig, { no => $no, name => $n, lat => r6($la), lon => r6($lo) } }
$out{sigx} = { source => '서울 C-ITS 교차로 지도정보(서울특별시 교통빅데이터플랫폼 · 수집 2026-09-10) — 신호 교차로 번호·이름. 「(연등)」은 연동 보조 신호', items => \@sig };

# ⑧ 서울 열린데이터광장(키로 받아 구운 것 · 서초구만)
sub pages { my ($svc) = @_; my @r; for my $f (sort glob("$S/seoul/${svc}_*.json")) { my $j = rdj($f); my ($k) = keys %$j; push @r, @{$j->{$k}{row} || []} } @r }
my @park; for my $x (pages('GetParkInfo')) { next unless ($x->{ADDR} // '') =~ /서초구/ && $x->{LAT} && $x->{LAT} > 30; push @park, { name => $x->{PKLT_NM}, addr => $x->{ADDR}, kind => $x->{PKLT_KND_NM}, oper => $x->{OPER_SE_NM}, tel => $x->{TELNO} // '', cap => 0 + ($x->{TPKCT} || 0), fee => $x->{CHGD_FREE_NM}, night => $x->{NGHT_FREE_OPN_YN_NAME}, lat => r6($x->{LAT}), lon => r6($x->{LOT}) } }
my %pseen; @park = grep { !$pseen{$_->{name} . $_->{lat}}++ } @park;
my @heat; for my $x (pages('TbGtnHwcwP')) { next unless ($x->{AREA_CD} // '') =~ /^11650/ && $x->{LAT}; push @heat, { name => $x->{R_AREA_NM}, type => $x->{FACILITY_TYPE2} // $x->{FACILITY_TYPE1}, addr => $x->{R_DETL_ADD} // $x->{LOTNO_ADDR}, days => $x->{OPR_DAYS}, time => ($x->{OPR_START_TIME} // '') . '~' . ($x->{OPR_END_TIME} // ''), lat => r6($x->{LAT}), lon => r6($x->{LON}) } }
my @bike; for my $x (pages('tbCycleStationInfo')) { next unless ($x->{STA_LOC} // '') eq '서초구' && $x->{STA_LAT}; push @bike, { name => $x->{RENT_NM}, no => $x->{RENT_NO}, n => 0 + ($x->{HOLD_NUM} || 0), lat => r6($x->{STA_LAT}), lon => r6($x->{STA_LONG}) } }
sub hrs { my ($x) = @_; join(' ', map { my ($s, $c) = ($x->{"DUTYTIME${_}S"}, $x->{"DUTYTIME${_}C"}); ($s && $c) ? "$s-$c" : '-' } 1 .. 8) }   # 월화수목금토일공휴일
my (@hosp, %hseen); for my $x (pages('TbHospitalInfo')) { next unless ($x->{DUTYADDR} // '') =~ /서울특별시 서초구/ && $x->{WGS84LAT}; next if $hseen{$x->{HPID}}++;
  push @hosp, { name => $x->{DUTYNAME}, div => $x->{DUTYDIVNAM}, er => (($x->{DUTYERYN} // '') eq '1' ? 1 : 0), emcls => $x->{DUTYEMCLSNAME}, tel => $x->{DUTYTEL1} // '', ertel => $x->{DUTYTEL3} // '', addr => $x->{DUTYADDR}, h => hrs($x), lat => r6($x->{WGS84LAT}), lon => r6($x->{WGS84LON}) } }
my (@phar, %pse); for my $x (pages('TbPharmacyOperateInfo')) { next unless ($x->{DUTYADDR} // '') =~ /서울특별시 서초구/ && $x->{WGS84LAT}; next if $pse{$x->{HPID}}++;
  push @phar, { name => $x->{DUTYNAME}, tel => $x->{DUTYTEL1} // '', addr => $x->{DUTYADDR}, h => hrs($x), lat => r6($x->{WGS84LAT}), lon => r6($x->{WGS84LON}) } }
my @cold; for my $x (pages('TbGtnCwP')) { next unless (($x->{LOTNO_ADDR} // '') . ($x->{ROAD_NM_ADDR} // '')) =~ /서초구/ && $x->{LAT}; push @cold, { name => $x->{RESTAREA_NM}, type => $x->{FACILITY_TYPE2} // '', addr => $x->{ROAD_NM_ADDR} // $x->{LOTNO_ADDR}, cap => 0 + ($x->{UTZTN_PSBLTY_NOPE} || 0), note => substr($x->{RMRK} // '', 0, 120), lat => r6($x->{LAT}), lon => r6($x->{LOT}) } }
$out{seoul} = { source => '서울 열린데이터광장 OpenAPI(수집 2026-09-28): 공영주차장 안내(GetParkInfo) · 무더위쉼터(TbGtnHwcwP) · 한파쉼터(TbGtnCwP) · 따릉이 대여소(tbCycleStationInfo) · 병의원(TbHospitalInfo · 응급실 운영 여부) · 약국 운영시간(TbPharmacyOperateInfo) — 서초구만. 운영시간은 기관이 등록한 값이라 바뀌었을 수 있다',
  park => \@park, heat => \@heat, cold => \@cold, bike => \@bike, hosp => \@hosp, phar => \@phar };
printf "seoul hosp %d (er %d) · phar %d · cold %d\n", scalar(@hosp), scalar(grep { $_->{er} } @hosp), scalar(@phar), scalar(@cold);
printf "seoul park %d · heat %d · bike %d\n", scalar(@park), scalar(@heat), scalar(@bike);

open my $w, '>:raw', "$K/traffic-game/data/pubdata-seocho.json"; print $w JSON::PP->new->canonical->utf8->encode(\%out); close $w;
printf "livepop %d · drunk %d · risk %d · subway %d · bus %d · fac %s · sigx %d\n", scalar(keys %lp), scalar(@dr), scalar(@rk), scalar(@{$out{subway}{items}}), scalar(@stops), join(' ', map { "$_:" . scalar(@{$fac{$_}}) } sort keys %fac), scalar(@sig);
