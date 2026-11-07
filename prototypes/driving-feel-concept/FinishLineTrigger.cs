// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does grounded, weighty car physics stay drivable for a first-time player?
// Date: 2026-11-07

using UnityEngine;
using System;

[RequireComponent(typeof(Collider))]
public class FinishLineTrigger : MonoBehaviour
{
    public Action OnCarCrossed;

    // Compared by reference, not by Unity's Tag system — avoids requiring the
    // user to define a tag in Project Settings before this works.
    public GameObject targetObject;

    void OnTriggerEnter(Collider other)
    {
        if (targetObject != null && other.gameObject == targetObject)
            OnCarCrossed?.Invoke();
    }
}
