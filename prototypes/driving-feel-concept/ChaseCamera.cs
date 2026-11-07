// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does grounded, weighty car physics stay drivable for a first-time player?
// Date: 2026-11-07
// Minimal third-person chase camera. No smoothing options exposed deliberately —
// this prototype is about the CAR feel, not camera feel.

using UnityEngine;

public class ChaseCamera : MonoBehaviour
{
    public Transform target;
    public Vector3 offset = new Vector3(0f, 4f, -8f);
    public float followSharpness = 6f;
    public float lookSharpness = 8f;

    void LateUpdate()
    {
        if (target == null) return;

        Vector3 desiredPosition = target.TransformPoint(offset);
        transform.position = Vector3.Lerp(transform.position, desiredPosition, Time.deltaTime * followSharpness);

        Quaternion desiredRotation = Quaternion.LookRotation(target.position + Vector3.up * 1f - transform.position, Vector3.up);
        transform.rotation = Quaternion.Slerp(transform.rotation, desiredRotation, Time.deltaTime * lookSharpness);
    }
}
