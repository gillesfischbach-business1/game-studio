// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does grounded, weighty car physics (Pillar 4: Grounded Drive,
// Weighty Consequence) stay drivable for a first-time player on their first
// attempt (the Accessibility Floor), or do those two things conflict?
// Date: 2026-11-07
//
// This single script builds the entire test scene from code at Play time:
// ground, a rough oval test track (straight + tight corner + wide corner,
// looped), the car, the chase camera, a finish-line lap counter, and an
// on-screen HUD. There is nothing to hand-assemble in the Scene view —
// see README.md for the two-step setup.

using UnityEngine;

public class PrototypeBootstrap : MonoBehaviour
{
    [Header("Read-only at runtime — tune CarController's values instead")]
    public CarController car;

    Rigidbody carRb;
    GameObject carObject;
    Vector3 startPosition;
    Quaternion startRotation;

    int attemptNumber = 1;
    int lapCount = 0;
    float attemptStartTime;
    float lastLapTime = -1f;
    float bestLapTime = -1f;
    bool offTrackWarningShown = false;

    const float GroundY = 0f;
    const float TrackThickness = 1f;
    const float TrackWidth = 10f;

    void Start()
    {
        BuildGround();
        BuildTrack();
        carObject = BuildCar();
        BuildChaseCamera(carObject.transform);
        BuildFinishLine();

        startPosition = carObject.transform.position;
        startRotation = carObject.transform.rotation;
        attemptStartTime = Time.time;
    }

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.R))
            ResetCar("manual reset (R)");

        // Safety net: if the car somehow falls through/off the world, reset it.
        if (carRb != null && carRb.transform.position.y < -5f)
            ResetCar("fell off the world");
    }

    void ResetCar(string reason)
    {
        carRb.transform.position = startPosition;
        carRb.transform.rotation = startRotation;
        carRb.linearVelocity = Vector3.zero;
        carRb.angularVelocity = Vector3.zero;
        attemptNumber++;
        attemptStartTime = Time.time;
        Debug.Log($"[Prototype] Reset — {reason}. Starting attempt {attemptNumber}.");
    }

    void HandleFinishLineCrossed()
    {
        lapCount++;
        float lapTime = Time.time - attemptStartTime;
        lastLapTime = lapTime;
        if (bestLapTime < 0f || lapTime < bestLapTime)
            bestLapTime = lapTime;
        attemptStartTime = Time.time;
        Debug.Log($"[Prototype] Lap {lapCount} complete in {lapTime:F1}s (attempt {attemptNumber}).");
    }

    // ---------- Scene construction ----------

    void BuildGround()
    {
        GameObject ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
        ground.name = "Ground_OffTrack";
        ground.transform.position = new Vector3(60f, GroundY - 0.01f, 0f);
        ground.transform.localScale = new Vector3(30f, 1f, 30f); // Unity planes are 10x10 at scale 1
        SetColor(ground, new Color(0.25f, 0.45f, 0.2f)); // grass green — "you left the track" cue
    }

    void BuildTrack()
    {
        // Rough oval: two straights + a tight corner cap + a wide corner cap.
        // Centerline runs along Z at x=0 and x=120; caps close the loop at
        // z=+45 (tight) and z=-45 (wide). Deliberately approximate — this is
        // a grey-box feel test, not a precision track.
        CreateTrackSegment("Track_StraightA", new Vector3(0f, GroundY, 0f), Vector3.zero, new Vector3(TrackWidth, TrackThickness, 80f));
        CreateTrackSegment("Track_StraightB", new Vector3(120f, GroundY, 0f), Vector3.zero, new Vector3(TrackWidth, TrackThickness, 80f));
        CreateTrackSegment("Track_CornerTight", new Vector3(60f, GroundY, 45f), Vector3.zero, new Vector3(130f, TrackThickness, 15f));
        CreateTrackSegment("Track_CornerWide", new Vector3(60f, GroundY, -45f), Vector3.zero, new Vector3(130f, TrackThickness, 35f));
    }

    void CreateTrackSegment(string name, Vector3 center, Vector3 eulerRotation, Vector3 size)
    {
        GameObject seg = GameObject.CreatePrimitive(PrimitiveType.Cube);
        seg.name = name;
        seg.transform.position = center + new Vector3(0f, -TrackThickness * 0.5f, 0f);
        seg.transform.eulerAngles = eulerRotation;
        seg.transform.localScale = size;
        SetColor(seg, new Color(0.3f, 0.3f, 0.32f)); // dark asphalt gray
    }

    GameObject BuildCar()
    {
        GameObject carObj = GameObject.CreatePrimitive(PrimitiveType.Cube);
        carObj.name = "PrototypeCar";
        carObj.transform.position = new Vector3(0f, 0.6f, -35f); // on StraightA, facing the tight-corner end
        carObj.transform.rotation = Quaternion.identity;
        carObj.transform.localScale = new Vector3(1.8f, 1f, 4f); // roughly car-shaped box
        SetColor(carObj, new Color(0.8f, 0.1f, 0.1f)); // red — easy to spot against the track

        Rigidbody rb = carObj.AddComponent<Rigidbody>();
        carRb = rb;

        car = carObj.AddComponent<CarController>();
        return carObj;
    }

    void BuildChaseCamera(Transform target)
    {
        GameObject camObj = new GameObject("PrototypeChaseCamera");
        Camera cam = camObj.AddComponent<Camera>();
        cam.tag = "MainCamera";
        ChaseCamera chase = camObj.AddComponent<ChaseCamera>();
        chase.target = target;

        // Simple directional light so the scene isn't pitch black —
        // a fresh empty scene has no light if the default one was deleted.
        if (FindAnyObjectByType<Light>() == null)
        {
            GameObject lightObj = new GameObject("PrototypeSun");
            Light light = lightObj.AddComponent<Light>();
            light.type = LightType.Directional;
            lightObj.transform.rotation = Quaternion.Euler(50f, -30f, 0f);
        }
    }

    void BuildFinishLine()
    {
        GameObject finish = new GameObject("FinishLine");
        finish.transform.position = new Vector3(0f, GroundY + 0.5f, -35f);
        BoxCollider box = finish.AddComponent<BoxCollider>();
        box.isTrigger = true;
        box.size = new Vector3(TrackWidth, 3f, 1f);
        FinishLineTrigger trigger = finish.AddComponent<FinishLineTrigger>();
        trigger.targetObject = carObject;
        trigger.OnCarCrossed = HandleFinishLineCrossed;
    }

    void SetColor(GameObject obj, Color color)
    {
        Renderer r = obj.GetComponent<Renderer>();
        if (r == null) return;
        Material mat = new Material(Shader.Find("Universal Render Pipeline/Lit"));
        if (mat.shader == null || !mat.shader.isSupported)
            mat = new Material(Shader.Find("Standard")); // fallback if URP isn't the active pipeline
        mat.color = color;
        r.material = mat;
    }

    // ---------- HUD ----------

    void OnGUI()
    {
        if (car == null) return;

        GUIStyle style = new GUIStyle(GUI.skin.label) { fontSize = 20, normal = { textColor = Color.white } };
        GUI.Box(new Rect(10, 10, 260, 150), "");
        GUI.Label(new Rect(20, 15, 240, 30), $"Speed: {car.CurrentSpeedKmh:F0} km/h", style);
        GUI.Label(new Rect(20, 45, 240, 30), $"Attempt: {attemptNumber}", style);
        GUI.Label(new Rect(20, 75, 240, 30), $"Laps completed: {lapCount}", style);
        string lastLapText = lastLapTime >= 0f ? $"{lastLapTime:F1}s" : "—";
        string bestLapText = bestLapTime >= 0f ? $"{bestLapTime:F1}s" : "—";
        GUI.Label(new Rect(20, 105, 240, 30), $"Last / Best lap: {lastLapText} / {bestLapText}", style);
        GUI.Label(new Rect(20, 135, 240, 30), "R = reset to start", style);
    }
}
