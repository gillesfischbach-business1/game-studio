// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does grounded, weighty car physics (Pillar 4) stay drivable for a
// first-time player on their first attempt (the Accessibility Floor), or do
// those two things conflict?
// Date: 2026-11-07

using UnityEngine;

// All the numbers below are exposed to the Inspector on purpose: you don't
// need to read or edit this code to tune the feel. Click the car in the
// Hierarchy while the game is NOT running, change a slider, press Play again.
[RequireComponent(typeof(Rigidbody))]
public class CarController : MonoBehaviour
{
    [Header("Engine")]
    [Tooltip("Forward/backward push force. Higher = more aggressive acceleration.")]
    [Range(2000f, 20000f)] public float engineForce = 9000f;

    [Tooltip("Top speed in meters/second (roughly top km/h divided by 3.6). 20 = about 72 km/h.")]
    [Range(5f, 40f)] public float maxSpeed = 20f;

    [Tooltip("Braking force when you press brake/reverse while still moving forward.")]
    [Range(2000f, 20000f)] public float brakeForce = 12000f;

    [Header("Steering")]
    [Tooltip("Turning torque at low/zero speed.")]
    [Range(500f, 8000f)] public float steerTorque = 3500f;

    [Tooltip("0 = full steering power is kept even at top speed (easy, a bit arcade-y). " +
             "1 = steering power fades to zero at top speed (more realistic, harder).")]
    [Range(0f, 1f)] public float steerLossAtTopSpeed = 0.6f;

    [Header("Grip — THIS IS THE MAIN DIAL FOR THE PROTOTYPE'S QUESTION")]
    [Tooltip("How much sideways sliding gets cancelled every physics step. " +
             "1 = no sliding at all (feels like a go-kart glued to the road: easy, but not 'weighty'). " +
             "0 = no grip at all (feels like driving on ice: 'weighty'/slidey, but very hard to control). " +
             "Start at 0.85. If the car feels too glued-down and arcade-y, lower this. " +
             "If it's too hard to keep on the road, raise it.")]
    [Range(0f, 1f)] public float lateralGrip = 0.85f;

    [Header("Weight feel")]
    [Tooltip("Rigidbody mass in kg. Higher = more inertia: slower to speed up, slower to stop, slower to turn.")]
    [Range(400f, 3000f)] public float carMass = 1400f;

    [Tooltip("Linear damping (Unity 6's new name for what used to be called 'drag'). " +
             "Higher = the car loses speed faster when you let go of the gas.")]
    [Range(0f, 2f)] public float linearDrag = 0.3f;

    Rigidbody rb;
    float throttleInput;
    float steerInput;

    void Awake()
    {
        rb = GetComponent<Rigidbody>();
        rb.mass = carMass;
        rb.linearDamping = linearDrag;
        rb.angularDamping = 3f;
        rb.interpolation = RigidbodyInterpolation.Interpolate;
        rb.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
        // Lower center of mass so the car doesn't tip over in corners — a cheap
        // stand-in for a real suspension/wheel setup, which this prototype skips.
        rb.centerOfMass = new Vector3(0f, -0.4f, 0f);
    }

    void Update()
    {
        // Legacy Input Manager (works out of the box on a fresh 3D project —
        // no Input System package/setup required for this prototype).
        throttleInput = Input.GetAxis("Vertical");   // W/S or Up/Down arrows
        steerInput = Input.GetAxis("Horizontal");    // A/D or Left/Right arrows
    }

    void FixedUpdate()
    {
        float forwardSpeed = Vector3.Dot(rb.linearVelocity, transform.forward);
        float speedFraction = Mathf.Clamp01(Mathf.Abs(forwardSpeed) / maxSpeed);

        if (throttleInput > 0f)
        {
            if (forwardSpeed < maxSpeed)
                rb.AddForce(transform.forward * throttleInput * engineForce);
        }
        else if (throttleInput < 0f)
        {
            if (forwardSpeed > 0.5f)
                rb.AddForce(-transform.forward * brakeForce); // braking while moving forward
            else if (forwardSpeed > -maxSpeed * 0.5f)
                rb.AddForce(transform.forward * throttleInput * engineForce * 0.5f); // reversing
        }

        float steerAuthority = Mathf.Lerp(1f, 1f - steerLossAtTopSpeed, speedFraction);
        rb.AddTorque(Vector3.up * steerInput * steerTorque * steerAuthority);

        // Simplified tire grip: cancel part of the sideways velocity every step.
        Vector3 localVel = transform.InverseTransformDirection(rb.linearVelocity);
        localVel.x *= (1f - lateralGrip);
        rb.linearVelocity = transform.TransformDirection(localVel);

        if (rb.linearVelocity.magnitude > maxSpeed * 1.05f)
            rb.linearVelocity = rb.linearVelocity.normalized * (maxSpeed * 1.05f);
    }

    public float CurrentSpeedKmh => rb != null ? rb.linearVelocity.magnitude * 3.6f : 0f;
}
