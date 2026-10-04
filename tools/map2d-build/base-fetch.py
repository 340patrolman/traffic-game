import urllib.request, urllib.parse, sys, time
B = '37.395,126.935,37.535,127.135'
Q1 = '[out:json][timeout:300];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|.*_link|pedestrian|footway|cycleway|path|steps|service)$"](BBOX);way["waterway"](BBOX);way["natural"="water"](BBOX);relation["natural"="water"](BBOX);way["leisure"~"^(park|pitch|garden|playground|golf_course)$"](BBOX);way["landuse"~"^(forest|grass|recreation_ground|cemetery)$"](BBOX);way["natural"~"^(wood|scrub|grassland)$"](BBOX);relation["leisure"="park"](BBOX);relation["landuse"="forest"](BBOX);relation["natural"="wood"](BBOX);way["railway"~"^(rail|subway|light_rail)$"](BBOX);way["amenity"="parking"](BBOX););out body geom;'.replace('BBOX', B)
Q2 = '[out:json][timeout:120];(node["name"~"(사거리|삼거리|오거리|교차로|입구|네거리)$"](BBOX);node["highway"="traffic_signals"]["name"](BBOX);node["junction"]["name"](BBOX););out body;'.replace('BBOX', B)
for nm, q in (('osm.json', Q1), ('junc.json', Q2)):
    for url in ('https://overpass-api.de/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'):
        try:
            r = urllib.request.Request(url, data=urllib.parse.urlencode({'data': q}).encode(), headers={'User-Agent': 'seoul-patrol-map2d/1.0'})
            b = urllib.request.urlopen(r, timeout=400).read()
            if len(b) < 1000: raise Exception(b[:200])
            open(nm, 'wb').write(b); print(nm, len(b), url); break
        except Exception as e: print('fail', url, e); time.sleep(3)
