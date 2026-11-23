"""Render the footprints atlas from local Natural Earth 5.1.2 GeoJSON layers."""

import argparse
import html
import json
import math
import re
from collections import defaultdict
from pathlib import Path


WIDTH, HEIGHT = 1440, 920
DEG = math.pi / 180
PARALLEL_1, PARALLEL_2 = 25 * DEG, 47 * DEG


def tangent(latitude):
    return math.tan(math.pi / 4 + latitude / 2)


CONE = math.log(math.cos(PARALLEL_1) / math.cos(PARALLEL_2)) / math.log(
    tangent(PARALLEL_2) / tangent(PARALLEL_1)
)
ORIGIN = (tangent(36 * DEG) ** -CONE)


def project(position):
    """Lambert conformal conic, centered at 104°E / 36°N."""
    longitude, latitude = position[:2]
    radius = tangent(max(-85, min(85, latitude)) * DEG) ** -CONE
    angle = CONE * (longitude - 104) * DEG
    return radius * math.sin(angle), radius * math.cos(angle) - ORIGIN


def load_layer(directory, name):
    return json.loads((directory / f"ne_10m_{name}.geojson").read_text(encoding="utf-8"))["features"]


def polygons(geometry):
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"]]
    return geometry["coordinates"]


def lines(geometry):
    if geometry["type"] == "LineString":
        return [geometry["coordinates"]]
    return geometry["coordinates"]


def intersects(points, west, south, east, north):
    xs, ys = zip(*(point[:2] for point in points))
    return min(xs) <= east and max(xs) >= west and min(ys) <= north and max(ys) >= south


def reduce_vertices(points, spacing):
    result = [points[0]]
    for point in points[1:-1]:
        if math.dist(point, result[-1]) >= spacing:
            result.append(point)
    result.append(points[-1])
    return result


def svg_path(points, close=False):
    coordinates = " ".join(f"{x:.1f},{y:.1f}" for x, y in points)
    return f"M{coordinates}{'Z' if close else ''}"


def render(data, output):
    admin = load_layer(data, "admin_1_states_provinces")
    countries = load_layer(data, "admin_0_countries")
    country_by_code = {feature["properties"]["ADM0_A3"]: feature["geometry"] for feature in countries}
    regions = {}
    province_names = {}
    for feature in admin:
        properties = feature["properties"]
        code = properties["iso_3166_2"]
        if properties["admin"] == "China" and re.fullmatch(r"CN-[A-Z]{2}", code or ""):
            region_id = code[-2:].lower()
            regions[region_id] = (properties["name_zh"], feature["geometry"])
            province_names[properties["name"]] = region_id

    extra_regions = {"HKG": ("hk", "香港"), "MAC": ("mo", "澳门"), "TWN": ("tw", "台湾")}
    for code, (region_id, label) in extra_regions.items():
        regions[region_id] = (label, country_by_code[code])

    focus = [(name, geometry) for name, geometry in regions.values()]
    projected = [project(point) for _, geom in focus for shape in polygons(geom) for point in shape[0]]
    px, py = zip(*projected)
    scale = min((WIDTH - 125) / (max(px) - min(px)), (HEIGHT - 105) / (max(py) - min(py)))
    origin_x = WIDTH / 2 - scale * (min(px) + max(px)) / 2
    origin_y = HEIGHT / 2 - scale * (min(py) + max(py)) / 2

    def screen(point):
        x, y = project(point)
        return origin_x + scale * x, origin_y + scale * y

    def normalized(point):
        x, y = point
        return [round(x / WIDTH, 6), round(y / HEIGHT, 6)]

    def path_for(geometry, context=False):
        paths = []
        for shape in polygons(geometry):
            if context and not intersects(shape[0], 65, 12, 141, 57):
                continue
            for ring in shape:
                path = reduce_vertices([screen(point) for point in ring], 0.55)
                if len(path) >= 4:
                    paths.append(svg_path(path, close=True))
        return "".join(paths)

    config = {
        "image": {
            "src": "/static/footprints/atlas.svg",
            "width": WIDTH,
            "height": HEIGHT,
            "alt": "米白底上的灰绿足迹地图，显示地区边界、道路和河流",
            "source": "Natural Earth 1:10m · 示意底图",
        },
        "provinces": [],
        "cities": [],
    }
    land_paths = []
    fills = ("#eaece3", "#edf0e6", "#e6ebe2", "#eff0e6", "#e9ece1")
    for index, (region_id, (name, geometry)) in enumerate(sorted(regions.items())):
        path = path_for(geometry)
        land_paths.append(f'<path fill="{fills[index % len(fills)]}" d="{path}"/>')
        outlines = []
        for shape in polygons(geometry):
            ring = reduce_vertices([screen(point) for point in shape[0]], 1.0)
            if len(ring) >= 4:
                outlines.append([normalized(point) for point in ring[:-1]])
        config["provinces"].append({"id": region_id, "name": name, "polygons": outlines})

    transport = defaultdict(list)
    for feature in load_layer(data, "roads"):
        rank = feature["properties"].get("scalerank") or 0
        for line in lines(feature["geometry"]):
            if intersects(line, 65, 12, 141, 57):
                transport["primary" if rank <= 4 else "secondary"].append(
                    svg_path(reduce_vertices([screen(point) for point in line], 0.5))
                )

    rivers = []
    for feature in load_layer(data, "rivers_lake_centerlines"):
        for line in lines(feature["geometry"]):
            if intersects(line, 65, 12, 141, 57):
                rivers.append(svg_path(reduce_vertices([screen(point) for point in line], 0.5)))

    places = load_layer(data, "populated_places")
    label_names = {"Beijing", "Shanghai", "Chengdu", "Kunming", "Lhasa", "Urumqi",
                   "Lanzhou", "Hohhot", "Harbin", "Shenyang", "Guangzhou",
                   "Wuhan", "Taipei", "Xian", "Haikou"}
    label_overrides = {"Chengdu": (7, -6), "Guangzhou": (-7, 11), "Shanghai": (-6, -8)}
    country_regions = {code: pair[0] for code, pair in extra_regions.items()}
    labels = []
    assigned_places = set()
    for feature in sorted(places, key=lambda item: item["properties"]["SCALERANK"]):
        props = feature["properties"]
        if props["ADM0_A3"] == "CHN":
            province = province_names.get(props.get("ADM1NAME"))
        else:
            province = country_regions.get(props["ADM0_A3"])
        if not province:
            continue
        place = props["NAMEASCII"]
        city_id = re.sub(r"[^a-z0-9]+", "-", place.lower()).strip("-")
        if not city_id or city_id in assigned_places:
            continue
        name = props["NAME_ZH"] or props["NAME"]
        x, y = screen(feature["geometry"]["coordinates"])
        city_point = normalized((x, y))
        if not all(0 <= coordinate <= 1 for coordinate in city_point):
            continue
        config["cities"].append({"id": city_id, "name": name, "province": province, "point": city_point})
        assigned_places.add(city_id)
        if place in label_names:
            dx, dy = label_overrides.get(place, (7, -6))
            anchor = "end" if dx < 0 else "start"
            labels.append(
                f'<circle cx="{x:.1f}" cy="{y:.1f}" r="2.1"/>'
                f'<text x="{x + dx:.1f}" y="{y + dy:.1f}" text-anchor="{anchor}">{html.escape(name)}</text>'
            )

    main_codes = ("CHN", *extra_regions)
    foreground = "".join(path_for(country_by_code[code]) for code in main_codes)
    neighbors = "".join(
        path_for(feature["geometry"], context=True)
        for feature in countries if feature["properties"]["ADM0_A3"] not in main_codes
    )
    graticule = [
        svg_path([screen((meridian, latitude)) for latitude in range(8, 62)])
        for meridian in range(70, 146, 5)
    ] + [
        svg_path([screen((longitude, parallel)) for longitude in range(63, 147)])
        for parallel in range(15, 61, 5)
    ]

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}">
<title>个人足迹地图</title>
<desc>地理数据来自 Natural Earth 1:10m，图幅及重点点位为示意。</desc>
<defs>
  <clipPath id="land"><path fill-rule="evenodd" d="{foreground}"/></clipPath>
  <style>text{{font: 11px "Microsoft YaHei","PingFang SC",sans-serif;letter-spacing:.07em;paint-order:stroke;stroke:#eef0e7;stroke-width:2.7px;stroke-linejoin:round}}</style>
</defs>
<rect width="100%" height="100%" fill="#f3f3ea"/>
<path d="{neighbors}" fill="#f7f5ed" fill-rule="evenodd" stroke="#d7ddcf" stroke-width=".7"/>
<path d="{"".join(graticule)}" fill="none" stroke="#83998a" stroke-opacity=".18" stroke-width=".65" stroke-dasharray="2 5"/>
<path d="{foreground}" fill="#e9ede4" stroke="#668573" stroke-width="2" fill-rule="evenodd"/>
<g fill-rule="evenodd" stroke="#879b8b" stroke-opacity=".85" stroke-width="1.15">{"".join(land_paths)}</g>
<g clip-path="url(#land)" fill="none" stroke-linejoin="round" stroke-linecap="round">
  <path d="{"".join(transport["secondary"])}" stroke="#88a090" stroke-width=".72" opacity=".56"/>
  <path d="{"".join(transport["primary"])}" stroke="#648674" stroke-width="1.25" opacity=".72"/>
  <path d="{"".join(rivers)}" stroke="#709b9a" stroke-width="1.25" opacity=".76"/>
</g>
<g fill="#365948">{"".join(labels)}</g>
</svg>
'''
    output.mkdir(parents=True, exist_ok=True)
    (output / "atlas.svg").write_text(svg, encoding="utf-8")
    (output / "map.json").write_text(json.dumps(config, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Directory holding the five Natural Earth GeoJSON layers")
    args = parser.parse_args()
    render(args.source, Path(__file__).resolve().parents[1] / "app/static/footprints")
